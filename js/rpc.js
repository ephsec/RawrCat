// **************************************************************************
// rpc calls to server
// **************************************************************************

var rawrRpc = function(rawrEnv) {

  var createResponseIntoCtx = function(ctx, req, start) {
    // Here, we actually return a function that does the job, to work around
    // scoping issues.
    return( function() {
      if (this.readyState === 4) {
        response = req.responseText;
        var end = ( new Date().getTime() ) - start;
        start = new Date().getTime();
        parsedResponse = rawrEnv.parse( rawrEnv.tokenize( response ) )
        var numRecords = parsedResponse.tokenCount
        var end2 = new Date().getTime() - start;
        console.log( [
          "{0}: {1} bytes returned by RPC call in {2} ms".format(
            ctx.thread, response.length, end ),
          "{0} tokens parsed in {1} ms".format(
            numRecords, end2 ) ].join("; ") );
        rawrEnv.exec( rawrEnv.executeQuotation(ctx, parsedResponse) )
      }
    } );
  }

  var rcRPC = function( ctx ) {
      var rcExecutionBlock = ctx.stack.pop();

      // Our RPC call is made via XMLHttpRequest asynchronously, though we
      // force this execution thread to wait until this completes.  The contents
      // of the execution block are sent to the server in JSON.
      var start = new Date().getTime(); 
      var myRequest = new XMLHttpRequest();
      myRequest.onload = createResponseIntoCtx(ctx, myRequest, start);
      myRequest.open( "POST", "/rc", true );
      myRequest.setRequestHeader( "Content-Type", "text/plain" );
      //console.log( "RPC:" + renderElement( rcExecutionBlock ) );
      //console.log( renderElement( rcExecutionBlock ) );
      myRequest.send( renderElement( rcExecutionBlock ) );

      // Tell exec() to halt.
      return( null )
    }

  var rcRPCl = function( ctx ) {
      var rcExecutionBlock = ctx.stack.pop();

      // Our RPC call is made via XMLHttpRequest asynchronously, though we
      // force this execution thread to wait until this completes.  The contents
      // of the execution block are sent to the server in JSON.
      var start = new Date().getTime(); 
      var myRequest = new XMLHttpRequest();
      myRequest.onload = createResponseIntoCtx(ctx, myRequest, start);
      myRequest.open( "POST", "/rc", true );
      myRequest.setRequestHeader( "Content-Type", "text/plain" );
      //console.log( "Executing call via RPC ... " )
      //console.log( "RPC:" + renderElement( rcExecutionBlock ) );
      myRequest.send( renderElement( rcExecutionBlock ) + " list" );

      // Tell exec() to halt.
      return( null )
    }

  var rcRPCa = function( ctx ) {
      var rcExecutionBlock = ctx.stack.pop();

      // Our RPC call is made via XMLHttpRequest asynchronously, though we
      // force this execution thread to wait until this completes.  The contents
      // of the execution block are sent to the server in JSON.
      var start = new Date().getTime(); 
      var myRequest = new XMLHttpRequest();
      myRequest.onload = createResponseIntoCtx(ctx, myRequest, start);
      myRequest.open( "POST", "/rc", true );
      myRequest.setRequestHeader( "Content-Type", "text/plain" );
      //console.log( "Executing call via RPC ... " )
      //console.log( "RPC:" + renderElement( rcExecutionBlock ) );
      myRequest.send( renderElement( rcExecutionBlock ) + " apply" );

      // Tell exec() to halt.
      return( null )
    }

  rawrEnv.words['rpcl'] = rcRPCl
  rawrEnv.words['rpca'] = rcRPCa
  rawrEnv.words['rpc'] = rcRPC
}

rawrRpc(rawr);
