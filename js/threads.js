var rawrThreads = function(rawrEnv) {
    var threads = {};

    var createThreadId = function() {
      // Create a random hex ID and ensure that it doesn't collide with
      // anything.
      var threadId = '%' + Math.floor(Math.random()*16384).toString(16)
      if ( threads.hasOwnProperty( threadId ) ) {
        // Already taken, recurisvely call ourself.
        return( createThreadId() );
      } else {
        // We don't have a threadID assigned, so we mark this as taken and
        // return the new threadID.
        threads[ threadId ] = null;
        return( threadId );
      }
    }

    rawrEnv.createThread = function(ctx) {
      if ( null == ctx.thread ) {
        // if our calling context doesn't have a thread ID, we generate and
        // assign one to it -- but it will not have a threadName.
        ctx.thread = createThreadId();
        threads[ ctx.thread ] = ctx;
      }

      var initialValues = ctx.stack.pop();
      var threadName = ctx.stack.pop();
      var threadQuotation = ctx.stack.pop();

      var threadCtx = { stack: initialValues,
                  tokens: rawrEnv.compile( threadQuotation.value ),
                  callbacks: [ rawrEnv.nextToken ],
                  depth: 0,
                  resolution: ctx.resolution,
                  trace: ctx.trace,
                  terminal: ctx.terminal,
                  thread: threadName + ":" + createThreadId(),
                  nextTokenCount: ctx.nextTokenCount };
      threads[ ctx.thread ] = threadCtx;
      rawrEnv.exec( threadCtx );
      return(ctx);
    }

    rawrEnv.stopAllThreads = function(ctx) {
      threads = {};
      return(ctx);
    }

    rawrEnv.createThread.doc = "( quotation name initialValues -- )"

    rawrEnv.words[ "thread" ] = rawrEnv.createThread
    rawrEnv.words[ "stop-threads" ] = rawrEnv.stopAllThreads 
}

rawrThreads(rawr);