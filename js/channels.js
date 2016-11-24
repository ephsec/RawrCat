// ****************************************************************************
// RawrCat Channels, Publish-Subscribe, and Named Stacks
// ****************************************************************************

var rawrChannels = function(rawrEnv) {

  rawrEnv.channels = {};
  rawrEnv.stacks = {};
  rawrEnv.pubsubs = {};

  var createChannel = function(ctx) {
    var channelToken = ctx.stack.pop();
    var channelName = channelToken.value;

    var channel = {};
    channel.readers = [];
    channel.writers = [];
    channel.value = channelName;

    // When we read from a channel, if there is a writer waiting to write,
    // we obtain the writer's context, pop an item off the writer's stack,
    // execute the writer's context and then return the reader context.
    //
    // If there are no writers, we block the reader context until there is a
    // writer.
    channel.read = function(readerCtx) {
      if (channel.writers.length) {
        var writerCtx = this.writers.shift();
        readerCtx.stack.push( writerCtx.stack.pop() );
        rawrEnv.exec( writerCtx );
        return( readerCtx );
      } else {
        channel.readers.push(readerCtx);
        return( null );
      }
    };

    // When we write to a channel, we are taking the context of the writer,
    // popping a value off the stack, and adding it to the reader's stack.
    // We then execute the reader's context.
    // 
    // If there are no readers, we effectively cease execution of the writer
    // until there's a reader, pushing it onto a writer queue.
    channel.write = function(writerCtx) {
      if (channel.readers.length) {
        var readerCtx = channel.readers.shift();
        readerCtx.stack.push( writerCtx.stack.pop() );
        rawrEnv.exec( readerCtx );
        return(writerCtx);
      } else {
        channel.writers.push(writerCtx);
        return(null);
      }
    };

    // check if there are any writers waiting to write to the channel;
    // this is useful to ensure that a reader does not block waiting for a
    // writer
    channel.checkWriters = function() {
      return( ( channel.writers.length > 0 ) );
    };

    // Flush out any pending reads and writes on a channel.
    channel.stop = function() {
      channel.readers = [];
      channel.writers = [];
    }

    rawrEnv.channels[ channelName ] = channel;
    return( ctx );
  }

  var getPubSub = function(pubSubName) {
    if ( rawrEnv.pubsubs.hasOwnProperty( pubSubName ) ) {
      return( rawrEnv.pubsubs[ pubSubName ] )
    } else {
      throw( "PubSubNotFound:" + pubSubName )
    }
  }

  var getChannel = function(channelName) {
    if ( rawrEnv.channels.hasOwnProperty( channelName ) ) {
      return( rawrEnv.channels[ channelName ] )
    } else {
      throw( "ChannelNotFound:" + channelName )
    }
  }

  rawrEnv.getStack = function(stackToken) {
    var stackName = stackToken.value;
    return( getStack(stackName) );
  }

  var getStack = function(stackName) {
    if ( rawrEnv.stacks.hasOwnProperty( stackName ) ) {
      return( rawrEnv.stacks[ stackName ] );
    } else {
      throw( "StackNotFound:" + stackName )
    }
  }

  var createPubSub = function(ctx) {
    var pubSubToken = ctx.stack.pop();
    var pubSubName = pubSubToken.value;
    var subscribers = [];

    var pubsub = {};

    // When we publish a value, we execute each subscriber's code into a
    // new context to evaluate the value.
    pubsub.publish = function(value) {
      for (var i=0; i<subscribers.length; i++) {
        var tempCtx = { stack: [ rawrEnv.clone( value ) ],
                tokens: subscribers[i].slice(0),
                callbacks: [ rawrEnv.nextToken ],
                depth: 0,
                resolution: ctx.resolution,
                trace: ctx.trace,
                terminal: ctx.terminal,
                thread: ctx.thread,
                nextTokenCount: ctx.nextTokenCount };
        rawrEnv.exec(tempCtx);
      }
    }

    // When we subscribe, we are registering a RawrCat quotation that
    // is executed every time something is published.
    pubsub.subscribe = function(quotation, subName) {
      quotation.subName = subName;
      subscribers.push( quotation );
    }

    rawrEnv.pubsubs[ pubSubName ] = pubsub;

    return(ctx);
  }

  var createStack = function(ctx) {
    var stackToken = ctx.stack.pop();
    var stackName = stackToken.value;
    var filters = [];

    var stack = { array: [] };

    stack.pop = function() {
      return( stack.array.pop() );
    }

    stack.push = function(value) {
      stack.array.push( value );
      for (var i=0; i<filters.length; i++) {
        var tempCtx = { stack: [ value ],
                tokens: filters[i].slice(0),
                callbacks: [ rawrEnv.nextToken ],
                depth: 0,
                resolution: ctx.resolution,
                trace: ctx.trace,
                terminal: ctx.terminal,
                thread: ctx.thread,
                nextTokenCount: ctx.nextTokenCount };
        rawrEnv.exec(tempCtx);
      }
    }

    stack.add_trigger = function(quotation) {
      filters.push( quotation );
    }

    rawrEnv.stacks[ stackName ] = stack;

    return(ctx);
  }


  var writeChSt = function(ctx) {
    var workValue;
    var chSt = ctx.stack.pop();
    switch( chSt.tokenType ) {
      case "RCChannel":
        var channel = getChannel(chSt.value);
        return( channel.write(ctx) );
      case "RCStack":
        workValue = ctx.stack.pop();
        var stack = getStack(chSt.value);
        stack.push( workValue );
        return( ctx );
      case "RCPubSub":
        workValue = ctx.stack.pop();
        var pubsub = getPubSub(chSt.value);
        pubsub.publish( rawrEnv.clone(workValue) );
        return( ctx );
      default:
        throw( "InvalidTokenForWrite: " + chSt.value );
    }
  };

  var readChSt = function(ctx) {
    var chSt = ctx.stack.pop();

    switch( chSt.tokenType ) {
      case "RCChannel":
        var channel = getChannel(chSt.value);
        return( channel.read(ctx) );
      case "RCStack":
        var stack = getStack(chSt.value);
        ctx.stack.push( stack.pop() );
        return( ctx );
      default:
        throw( "InvalidTokenForRead: " + chSt.value );
    }
  };

  var createTrigger = function(ctx) {
    var quotation = ctx.stack.pop();
    var stackToken = ctx.stack.pop();
    var stack = getStack(stackToken.value);
    stack.add_trigger( quotation.value.value.slice(0).reverse() );
    return( ctx );
  }

  var createSubscription = function(ctx) {
    var subName = ctx.stack.pop();
    var quotation = ctx.stack.pop();
    var pubsubToken = ctx.stack.pop();
    var pubsub = getPubSub(pubsubToken.value);
    pubsub.subscribe( quotation.value.value.slice(0).reverse(), subName );
    return( ctx );
  }

  var checkWriters = function(ctx) {
    var channel = getChannel(ctx.stack.pop().value);
    ctx.stack.push( channel.checkWriters() );
    return( ctx );
  }

  var stopChannel = function(ctx) {
    var channelName = ctx.stack.pop();
    var channel = getChannel(channelName);
    if ( null != channel ) {
      channel.stop();
      delete rawrEnv.channels[ channelName ];
    }
    return( ctx );
  }

  rawrEnv.words[ 'stop_channel' ] = stopChannel;
  rawrEnv.words[ 'create_pubsub' ] = createPubSub;
  rawrEnv.words[ 'create_channel' ] = createChannel;
  rawrEnv.words[ 'create_stack' ] = createStack;
  rawrEnv.words[ 'create_trigger' ] = createTrigger;
  rawrEnv.words[ 'subscribe' ] = createSubscription;
  rawrEnv.words[ '<-' ] = writeChSt;
  rawrEnv.words[ '->' ] = readChSt;
  rawrEnv.words[ '?>' ] = checkWriters;

}

rawrChannels(rawr);