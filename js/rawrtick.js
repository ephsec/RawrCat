// We use MessageChannel for a lower latency yield and setTimeout where
// possible.  Initializing rawrTick with rawrEnv will override the `yield`
// definition with our more optimal code.
var rawrTick = function(rawrEnv) {
      // http://www.nonblocking.io/2011/06/windownexttick.html
      var channel = new MessageChannel();
      var queue = [];

      channel.port1.onmessage = function () {
          // grab a context off the left of the queue and execute
          // it.
          var ctx = queue.shift();
          //console.log( ctx.thread + " got control" );
          rawrEnv.exec( ctx );
      };
      rawrEnv.nextTick = function (ctx) {
          //console.log( ctx.thread + " yielded control" );
          queue.push( ctx );
          channel.port2.postMessage(0);
          // return null to stop execution of this contex
          return(null);
      };

      rawrEnv.words[ 'yield' ] = rawrEnv.nextTick;
}

// We check for the existence of MessageChannel as Firefox doesn't implement it.
// Nor does node.js, but node.js has a nextTick call.
if ( !isNode && window.hasOwnProperty( "MessageChannel" ) ) {
  rawrTick(rawr);
}