// ****************************************************************************
// RawrCat - A Concatenative Programming Language
// 
// Wes Brown
// (c) Ephemeral Security 2014
//
// Licensed under the GPLv3 (http://www.gnu.org/copyleft/gpl.html)
// **************************************************************************** 

// First, figure out if we're Node.JS or not, as we don't typically have a
// DOM to interact with, and have some extra features not found in the browser
// Javascript engines.
isNode = !!(typeof module !== 'undefined' && module.exports);

// Method to support various mechanisms to load a library depending on
// environment.
function importJSLibrary(library) {
  // If window is undefined, then it's probably a node.js instance which
  // imports using 'require'.
  console.log( "Loading JavaScript file: " + library )
  if (typeof window == 'undefined') {
    require("./" + library)
  } else {
    // We're probably a browser, so we inject our script load into the DOM.
    var xhrObj = new XMLHttpRequest();
    xhrObj.open('GET', library, false);
    xhrObj.send('');

    var body = document.body;
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.text = xhrObj.responseText;

    body.appendChild(script);
  }
}

// ****************************************************************************
// RawrCat JavaScript types and JavaScript enhancements
// ****************************************************************************

// Make it easier for us to figure out if we're looking at an array or not!
Array.prototype.isArray = true;

// Extend the JavaScript String object with C-style format substitution.
if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

// OrderedHash - an implementation of a dictionary that is ordered to insertion
OrderedHash = function(inputPairs) {
  var keys = [];
  var vals = {};
  var orderedHash = {};

  orderedHash.push = function(k,v) {
    if ( !vals.hasOwnProperty(k) ) {
      keys.push(k);
    }
    vals[k] = v;
  };

  orderedHash.objects = vals;
  orderedHash.length = function() { return keys.length };
  orderedHash.keys = function() { return keys };
  orderedHash.val = function(k) { return vals[k] };
  orderedHash.vals = function() {
    retVals = [];
    for (var i=0; i<keys.length; i++) {
      retVals.push( vals[ keys[i] ] );
    }
    return(retVals);
  };
  orderedHash.keyvals = function() {
    retKeyVals = [];
    for (var i=0; i<keys.length; i++) {
      retKeyVals.push( [ keys[i], vals[ keys[i] ] ] );
    }
    return(retKeyVals);
  };
  orderedHash.contains = function(k) {
    return( vals.hasOwnProperty(k) );
  };
  orderedHash.get = function(k) {
    return( vals[k] )
  };
  orderedHash.rm = function(k) {
    keys.splice( keys.indexOf(k) );
    delete vals[k];
  };
  orderedHash.toJS = function() {
    return( vals );
  };
  orderedHash.keyPush = function(k, v) {
    vals[k].push(v);
  };
  orderedHash.exists = function(k) {
    if ( null !== vals[k] ) {
        return(true);
    } else {
        return(false);
    }
  };
  orderedHash.clone = function() {
    return( OrderedHash( orderedHash.keyvals() ) );
  };
  if ( inputPairs.length > 0 ) {
    for (var i=0; i<inputPairs.length; i++) {
      orderedHash.push(inputPairs[i][0], inputPairs[i][1])   
    }
  } else if ( typeof( inputPairs ) === 'object' ) {
    for ( key in inputPairs ) {
      if ( inputPairs.hasOwnProperty( key ) ) {
        orderedHash.push( key, inputPairs[ key ] )
      }
    }
  }
  orderedHash.tokenType = "RCHash";
  return( orderedHash );
};

// ****************************************************************************
// Core RawrCat interpreter and primitives
// ****************************************************************************

var rawrcat = function () {
  // Our RawrCat environment object -- note that multiple rawrcat environments
  // can be instantiated in this fashion, although currently RawrCat extensions
  // under 'js/' assume that they are extending a 'rawr' object in the
  // global namespace.
  var rawrEnv = {};

  // A more sane way to instantiate object copies
  function clone(o) {
    if ( null == o ) {
      return(o);
    } else if (o.hasOwnProperty( "tokenType" ) && o.tokenType == "RCHash") {
      return(o.clone());
    } else if (typeof(o.slice) == 'function') {
      return(o.slice(0));
    } else {
      return(o);
    }
  }
  rawrEnv.clone = clone;

  // Default nextTick is setTimeout but can be overriden.
  rawrEnv.nextTick = function( ctx ) {
    setTimeout( function () { rawrEnv.exec(ctx) }, 0 );
  };

  // **************************************************************************
  // RawrCat primitives
  // **************************************************************************

  // All RawrCat language primitives at the JavaScript level accept a context
  // object 'ctx', manipulate the context, and return the altered 'ctx' object
  // to the calling function.
  //
  // Typically, a number of items are popped off the stack contained in the
  // context, and optionally, results are pushed back onto the stack.
  //
  // RawrCat primitives are also callable from JavaScript if the JavaScript
  // environment has a context object to pass in.

  function pop(ctx) {
    ctx.stack.pop();
    return(ctx);
  }

  // peek() is an internal function call, one of the few primitives that returns
  // a value rather than a context.  Because it doesn't return a context, it is
  // not accessible or usable from the RawrCat language.  This is done because
  // it is actually faster to pop a value and then push it back onto the stack
  // than it is to do an indexed lookup of the end of the stack.
  function peek(ctx) {
    var x = ctx.stack.pop();
    ctx.stack.push(x);
    return(x);
  }

  function swap(ctx) {
    ctx.stack.push( ctx.stack.pop(), ctx.stack.pop() );
    return(ctx);
  }

  function dup(ctx) {
    var x = ctx.stack.pop();
    ctx.stack.push(x, clone(x));
    return(ctx);
  }

  function compose(ctx) {
    var x = ctx.stack.pop();
    var y = ctx.stack.pop();
    var f = function (ctx) {
      return(y(x(ctx)));
    };
    f.value = [ y, x ];
    f.tokenType = "RCQuotation";
    ctx.stack.push( f );
    return(ctx);
  }

  function quote(ctx) {
    var x = ctx.stack.pop();
    var f = function (ctx) { ctx.stack.push( x ); return(ctx) };
    f.value = rawrEnv.renderElement(x);
    ctx.stack.push( f );
    return(ctx);
  }

  function cat_if(ctx) {
    var f = ctx.stack.pop();
    var t = ctx.stack.pop();

    return( ctx.stack.pop()
              // true condition
              ? t(ctx)
              // false condition
              : f(ctx) );

    //if (ctx.stack.pop()) { return(t(ctx)) } else { return(f(ctx)) };
  }

  function cat_while(ctx) {
    var b = ctx.stack.pop();
    var f = ctx.stack.pop();

    var whileLoop = function(ctx) {
      ctx.callbacks.push( checkConditional );
      ctx.callbacks.push( b );
      return(ctx);
    };

    var checkConditional = function(ctx) {
      if ( ctx.stack.pop() ) {
        ctx.callbacks.push( whileLoop );
        ctx.callbacks.push( f );
      }
      return(ctx);
    };

    return(whileLoop(ctx));
  }

  function forever(ctx) {
    var f = ctx.stack.pop();

    var foreverLoop = function(ctx) {
      ctx.callbacks.push( foreverLoop );
      return(f(ctx));
    };

    return(foreverLoop(ctx));

  }

  function list(ctx) {
    var f = ctx.stack.pop();
    // We store our current stack in a temporary value, as we are
    // going to be operating on an empty stack.  We used to create
    // an entirely new context, but the overhead of that is expensive.
    var oldStack = ctx.stack;
    ctx.stack = [];

    // when we're done runnning our quotation, we revert back to the original
    // context passed in, and push the temporay stack onto our original stack
    ctx.callbacks.push(
      function(ctx) {
        // We push the resulting stack onto the original stack, and
        // replace the context's stack with the result.
        oldStack.push( ctx.stack );
        ctx.stack = oldStack;
        ctx.trace && traceCtxState( ctx.stack, ctx );
        return(ctx)
      });
    // finally, we run our function on the context with the empty stack
    return( f(ctx) );
  }

  function fold(ctx) {
    var f = ctx.stack.pop();
    var init = ctx.stack.pop();
    var a = ctx.stack.pop();
    var i = a.length - 1;

    var whileLoop = function(ctx) {
      if ( i >= 0 ) {
        ctx.stack.push(init);
        var x = a[i];
        ctx.stack.push(x);
        ctx.callbacks.push( // push our while loop closure
                            function (ctx) {
                              init = ctx.stack.pop();
                              --i;
                              return( whileLoop(ctx) ); },
                            // push function to execute
                            f );
      }
      return(ctx);
    };

    ctx.callbacks.push( function (ctx) {
                          ctx.stack.push( init );
                          return(ctx); } );

    return( whileLoop(ctx) );
  }

  function foreach(ctx) {
    var f = ctx.stack.pop();
    var a = ctx.stack.pop();
    var i = a.length;

    var forEachLoop = function(ctx) {
      if (i===0) return(ctx);
      var x = a.pop();
      ctx.stack.push(x);
      ctx.callbacks.push( function (ctx) {
                            --i;
                            return( forEachLoop(ctx)); } );
      ctx.callbacks.push( f );
      return(ctx);
    };

    return( forEachLoop(ctx) );
  }

  function load_js(ctx) {
    var library = ctx.stack.pop();

    console.log( "Loading JavaScript file: " + library );
    if (typeof window == 'undefined') {
      require("./" + library);
      return(ctx);
    } else {
      function responseIntoDOM(ctx) {
        return( function() {
          if (this.readyState === 4) {
            var body = document.body;
            var script = document.createElement('script');
            script.type = 'text/javascript';
            script.text = xhrObj.responseText;
            body.appendChild(script);
            rawrEnv.exec(ctx);
          }
        })
      }

      // We're probably a browser, so we inject our script load into the DOM.
      var xhrObj = new XMLHttpRequest();
      xhrObj.onload = responseIntoDOM(ctx);
      xhrObj.open('GET', library);
      xhrObj.send('');
      return(null);
    }
  }

  // Our dictionary with our core primitives, and our second order primitives
  // built on top of our core primitives.

  // It should be noted that we are operating directly on the stack out of the
  // context rather than calling the push and pop primitives; this is due to
  // function call coherency issues.
  var words = {
    'dup': dup,
    'compose': compose,
    'quote': quote,
    'swap': swap,
    'list': list,
    'fold': fold,
    'foreach': foreach,
    'if': cat_if,
    'while': cat_while,
    'forever': forever,
    'load_js': load_js,

    // add - (x y) { x y + }
    'add': function(ctx) { ctx.stack.push( ctx.stack.pop() + ctx.stack.pop());
                           return(ctx); },
    'div': function(ctx) { var x = ctx.stack.pop();
                           ctx.stack.push( ctx.stack.pop() / x );
                           return(ctx); },
    'sub': function(ctx) { var x = ctx.stack.pop();
                           ctx.stack.push( ctx.stack.pop() - x );
                           return(ctx); },
    'mod': function(ctx) { var x = ctx.stack.pop();
                           ctx.stack.push( ctx.stack.pop() % x );
                           return(ctx); },
    'mul': function(ctx) { ctx.stack.push( ctx.stack.pop() * ctx.stack.pop());
                           return(ctx); },
    'neg': function(ctx) { ctx.stack.push( -ctx.stack.pop());
                           return(ctx); },
    'nil': function(ctx) { ctx.stack.push( [] ); return(ctx); },
    'null': function(ctx) { ctx.stack.push( null ); return(ctx); },
    'true': function(ctx) { ctx.stack.push( true ); return(ctx); },
    'false': function(ctx) { ctx.stack.push( false ); return(ctx); },
    'empty': function(ctx) { ctx.stack.push( peek(ctx).length === 0 );
                             return(ctx); },
    'neq': function(ctx) { ctx.stack.push( ctx.stack.pop() !==
                                           ctx.stack.pop() ); return(ctx); },
    'lt': function(ctx) { ctx.stack.push( ctx.stack.pop() > ctx.stack.pop() );
                          return(ctx); },
    'lteq': function(ctx) { ctx.stack.push( ctx.stack.pop() >=
                                            ctx.stack.pop() );
                            return(ctx); },
    'gt': function(ctx) { ctx.stack.push( ctx.stack.pop() < ctx.stack.pop() );
                          return(ctx); },
    'gteq': function(ctx) { ctx.stack.push( ctx.stack.pop() <=
                                            ctx.stack.pop() );
                            return(ctx); },
    'not': function(ctx) { ctx.stack.push( false ); return( words['eq'](ctx) ); },
    'cons': function(ctx) { var x = ctx.stack.pop();
                              peek(ctx).push(x); return(ctx); },
    'uncons': function(ctx) { var x = ctx.stack.pop();
                              var y = x.pop();
                              ctx.stack.push( x );
                              ctx.stack.push( y );
                              return(ctx); },
    'eq': function(ctx) { ctx.stack.push( ctx.stack.pop() == ctx.stack.pop() );
                          return(ctx); },
    'count': function(ctx) { ctx.stack.push( peek(ctx).length );
                             return(ctx); },
    'apply': function(ctx) { return( ctx.stack.pop()(ctx) ) },
    'inc': function(ctx) { ctx.stack.push( ctx.stack.pop() + 1 );
                           return(ctx); },
    'dec': function(ctx) { ctx.stack.push( ctx.stack.pop() - 1 );
                           return(ctx); },
    'dip': function(ctx) { var f = ctx.stack.pop();
                           var x = ctx.stack.pop();
                           //ctx = f(ctx);
                           //ctx.stack.push(x);
                           //return(ctx); },
                           ctx.callbacks.push(
                             function(ctx) {ctx.stack.push(x);
                                            return(ctx); } );
                           //ctx = f(ctx)
                           return( f(ctx) ); },
    'pop': function(ctx) { --ctx.stack.length;
                           return(ctx); },
    'popd': function(ctx) { ctx = swap(ctx);
                            --ctx.stack.length;
                            return(ctx); },
    'pair': function(ctx) { var x = ctx.stack.pop();
                            ctx.stack.push( [ctx.stack.pop(), x] );
                            return(ctx); },
    'and': function(ctx) { var b = ctx.stack.pop();
                           if (ctx.stack.pop()) {ctx.stack.push( b )}
                           else {ctx.stack.push( false );}
                           return(ctx); },
    'unit': function(ctx) { var xs = [];
                            xs.push(ctx.stack.pop());
                            ctx.stack.push( xs );
                            return(ctx); },
    'repeat': function(ctx) { var n = ctx.stack.pop();
                              var f = ctx.stack.pop();

                              var repeatFn = function(ctx) {
                                return(
                                  0 < n--
                                    // We still have more to do.
                                    ? ( // Repeat after invoking f()
                                        ctx.callbacks.push( repeatFn ),
                                        // Invoke f().
                                        f(ctx) )
                                    // We no longer have more to do, return.
                                    : ctx );
                              };

                              return( repeatFn(ctx) ) },

    'head': function(ctx) { ctx = words['uncons'](ctx);
                            ctx = words['swap'](ctx);
                            ctx.stack.pop();
                            return(ctx); },
    'first': function(ctx) { var x = ctx.stack.pop();
                             ctx.stack.push(clone(x));
                             ctx.stack.push(x);
                             ctx = words['head'](ctx);
                             return( ctx ); },
    'rest': function(ctx) { ctx = words['uncons'](ctx);
                            ctx.stack.pop();
                            return( ctx ); },
    'tail': function(ctx) { return( words['rest']( dup(ctx) ) ) },
    'write': function(ctx) { var item = ctx.stack.pop();
                             if ( typeof( item ) !== "string" ) {
                              console.log( rawrEnv.renderElement( item ) );
                             } else {
                              console.log( item );
                             }
                             return(ctx); },
    'clear_stack': function(ctx) { ctx.stack.length = 0;
                                   return(ctx); },
    'define': function(ctx) { var funcName = ctx.tokens.pop().value;
                              var compiledTokens = rawrEnv.compile(
                                                          ctx.tokens.pop() );
                              words[ funcName ] = createQuotationFn(
                                                      compiledTokens );
                              return(ctx); },
    'get_canvas': function(ctx) {
                               var currCanvas = document.getElementById(
                                                  ctx.stack.pop() );
                               var currContext = currCanvas.getContext("2d");
                               ctx.stack.push( currContext );
                               return(ctx); },
    'set_color': function(ctx) { var b = ctx.stack.pop();
                              var g = ctx.stack.pop();
                              var r = ctx.stack.pop();
                              var currCanvas = peek(ctx);
                              currCanvas.fillStyle =
                                "rgb(" + [r,g,b].join(",") + ")";
                              return(ctx); },
    'fill_rect': function(ctx) { var y2 = ctx.stack.pop();
                              var x2 = ctx.stack.pop();
                              var y1 = ctx.stack.pop();
                              var x1 = ctx.stack.pop();
                              var currCanvas = peek(ctx);
                              currCanvas.fillRect(x1, y1, x2, y2);
                              return(ctx); },
    'rand': function(ctx) { ctx.stack.push(
                                    Math.floor( Math.random()
                                                * ctx.stack.pop()
                                                + ctx.stack.pop() ) );
                            return(ctx); },
    'display_stack': function(ctx) { console.log( renderElement( ctx.stack ) );
                                     return(ctx); },
    'hash': function(ctx) { var listToDo = ctx.stack.pop();
                            ctx.stack.push( OrderedHash(listToDo) );
                            return(ctx); },
    'hash_to_list': function(ctx) { var hash = ctx.stack.pop();
                                    ctx.stack.push( hash.keyvals() );
                                    return(ctx); },
    'hash_set': function(ctx) { var key = ctx.stack.pop();
                                var value = ctx.stack.pop();
                                var hash = ctx.stack.pop();
                                hash.push( key, value );
                                ctx.stack.push( hash );
                                return(ctx); },
    'hash_get': function(ctx) { var key = ctx.stack.pop();
                                var hash = ctx.stack.pop();
                                ctx.stack.push( hash );
                                ctx.stack.push( hash.get( key ) );
                                return(ctx); },
    'hash_rm': function(ctx) { var key = ctx.stack.pop();
                               var hash = ctx.stack.pop();
                               hash.rm( key );
                               ctx.stack.push( hash );
                               return(ctx); },
    'hash_cons': function(ctx) { var key = ctx.stack.pop();
                                 var value = ctx.stack.pop();
                                 var hash = ctx.stack.pop();
                                 hash.keyPush( key, value );
                                 ctx.stack.push( hash );
                                 return(ctx); },
    'hash_inc': function(ctx) { var key = ctx.stack.pop();
                                var hash = ctx.stack.pop();
                                var inc = hash.val( key );
                                inc++;
                                hash.push(key, inc);
                                ctx.stack.push(hash);
                                return(ctx); },
    'hash_safe_get': function(ctx) { var defvalue = ctx.stack.pop();
                                     var key = ctx.stack.pop();
                                     var hash = ctx.stack.pop();
                                     ctx.stack.push( hash );
                                     if ( hash.contains( key ) ) {
                                       ctx.stack.push( hash.get( key ) );
                                     } else {
                                       ctx.stack.push( defvalue );
                                     }
                                     return(ctx); },
    'hash_contains': function(ctx) { var key = ctx.stack.pop();
                                     var hash = ctx.stack.pop();
                                     ctx.stack.push(hash);
                                     if ( hash.contains( key ) ) {
                                      ctx.stack.push(true);
                                     } else {
                                      ctx.stack.push(false);
                                     }
                                     return(ctx); },
    'print_stack': function(ctx) { function stackElementPrinter(i, element) {
                                    return(
                                      function(ctx) {
                                          console.log( "\t" + i + ": "
                                                    + renderElement(element));
                                          return(ctx); } ) }

                                    for (var i=0;i<=ctx.stack.length-1;i++) {
                                      var element = ctx.stack[i];
                                      ctx.callbacks.push( stackElementPrinter(i,
                                        element) );
                                      }
                                   return(ctx) },
    'to_value': function(ctx) { ctx.stack.push( peek(ctx).valueOf(ctx.stack) );
                                return(ctx); },
    'from_json': function(ctx) { ctx.stack.push(
                                    JSON.parse( ctx.stack.pop() ) );
                                 return(ctx); },
    'to_json': function(ctx) { ctx.stack.push(
                                    JSON.stringify( ctx.stack.pop() ) );
                               return(ctx); },
    'from_string': function(ctx) { return( rawrEnv.executeQuotation( ctx,
                                    rawrEnv.parse( rawrEnv.tokenize(
                                      ctx.stack.pop() ) ) ) ) },
    'to_string': function(ctx) { ctx.stack.push( renderElement( peek(ctx) ) );
                                 return(ctx); },
    'trace': function(ctx) { ctx.trace = true;
                             return(ctx);},
    'literal': function(ctx) { var litToken = ctx.tokens.pop();
                               ctx.stack.push( litToken );
                               return(ctx); },
    'yieldn': function(ctx) { setImmediate(
                              function () { rawrEnv.exec( ctx ); } );
                             return(null); },
    'yield': function(ctx) { setImmediate(
                              function () { rawrEnv.exec( ctx ); } );
                             return(null); },
    'time': function(ctx) { var dateInt = new Date().getTime();
                            dateInt.value = dateInt;
                            ctx.stack.push( dateInt );
                            return(ctx); },
    'thread_id': function(ctx) { ctx.stack.push( ctx.thread );
                                 return(ctx); },
    'break': function(ctx) { return(null); },
    'chunk_list': function(ctx) { var i, j, chunk;
                                  var chunkSize = ctx.stack.pop();
                                  var listToChunk = ctx.stack.pop();
                                  for (i = 0, j = listToChunk.length;
                                       i < j;
                                       i += chunkSize) {
                                    chunk = listToChunk.slice(i, i + chunkSize);
                                    ctx.stack.push( chunk ); }
                                  return(ctx); },
    'depth': function(ctx) { ctx.stack.push( ctx.stack.length );
                             return(ctx); },
    'is_null': function(ctx) { var checkValue = ctx.stack.pop();
                               if ( null == checkValue ) {
                                ctx.stack.push( checkValue );
                                ctx.stack.push( true );
                               } else {
                                ctx.stack.push( checkValue );
                                ctx.stack.push( false );
                               }
                               return(ctx); },
    'rot': function(ctx) { var a = ctx.stack.pop();
                           var b = ctx.stack.pop();
                           var c = ctx.stack.pop();
                           ctx.stack.push(a);
                           ctx.stack.push(c);
                           ctx.stack.push(b);
                           return(ctx); },
    '-rot': function(ctx) { var a = ctx.stack.pop();
                            var b = ctx.stack.pop();
                            var c = ctx.stack.pop();
                            ctx.stack.push(b);
                            ctx.stack.push(a);
                            ctx.stack.push(c);
                            return(ctx); },
    'swapd': function(ctx) { var a = ctx.stack.pop();
                             var b = ctx.stack.pop();
                             var c = ctx.stack.pop();
                             ctx.stack.push(b);
                             ctx.stack.push(c);
                             ctx.stack.push(a);
                             return(ctx); },
    'rotd': function(ctx)  { var a = ctx.stack.pop();
                             var b = ctx.stack.pop();
                             var c = ctx.stack.pop();
                             var d = ctx.stack.pop();
                             ctx.stack.push(b);
                             ctx.stack.push(d);
                             ctx.stack.push(c);
                             ctx.stack.push(a);
                             return(ctx); },
    'contains': function(ctx) { var a = ctx.stack.pop();
                                if ( -1 !== ctx.stack.pop().indexOf(a) ) {
                                  ctx.stack.push(true);
                                } else {
                                  ctx.stack.push(false);
                                }
                                return(ctx); },
    'str_to_list': function(ctx) { var a = ctx.stack.pop();
                                   ctx.stack.push( a.split("") );
                                   return(ctx); },
    'list_to_str': function(ctx) { var a = ctx.stack.pop();
                                   ctx.stack.push( a.join("") );
                                   return(ctx); },
    'int_to_chr': function(ctx) { var a = ctx.stack.pop();
                                  ctx.stack.push( String.fromCharCode(a) );
                                  return(ctx); },
    'chr_to_int': function(ctx) { var a = ctx.stack.pop();
                                  ctx.stack.push( a.charCodeAt(0) );
                                  return(ctx); }
  };

  // aliased functions as we can't self-refer in an initial setup of an object
  var mathAlias = {
    '+': words[ 'add' ],
    '-': words[ 'sub' ],
    '/': words[ 'div' ],
    '*': words[ 'mul' ],
    '%': words[ 'mod' ],
    '<': words[ 'lt' ],
    '<=': words[ 'lteq' ],
    '>': words[ 'gt' ],
    '>=': words[ 'gteq' ],
    '==': words[ 'eq' ],
    '!=': words[ 'neq' ],
    '++': words[ 'inc' ],
    '--': words[ 'dec' ]
  };

  for ( var word in mathAlias ) {
    words[ word ] = mathAlias[ word ];
  }

  rawrEnv.words = words;

  // convenience function to create a new context or mirror an old context
  // this actually turns out to be pretty slow, because we're looping over
  // keys on an object passed in.
  var createContext = function(params) {
    var ctx = { stack: [],
                tokens: [],
                callbacks: [],
                depth: 0,
                resolution: 500,
                trace: false,
                terminal: null,
                thread: null,
                nextTokenCount: 0 };

    if ( params != null ) {
      for ( attribute in params ) {
        ctx[ attribute ] = params[ attribute ]
      }
    }

    return( ctx );
  };
  rawrEnv.createContext = createContext;

  // **************************************************************************
  // Bootstrap routine
  // **************************************************************************

  // given a context, and an input string containing a rawrcat program,
  // tokenize and parse the input, and execute it.
  rawrEnv.execute = function(inCtx, input) {
    var ctx = inCtx;
    var tokenized = rawrEnv.tokenize( input );
    var parsed = rawrEnv.parse( tokenized );
    tokenCount = 0;
    if ( parsed.value ) {
      //var initialQuotation = function() {
      //  return( rawrEnv.executeQuotation.bind( null, ctx, parsed ) );
      //}
      //console.log( Object.keys( initialQuotation ) );
      ctx.callbacks.push( function(ctx, parsed) { return( function () {
        return( rawrEnv.executeQuotation( ctx, parsed ) ) } ) }(ctx, parsed) );
      //console.log(ctx);
      exec(ctx);
    }
  };

  // **************************************************************************
  // Core RawrCat execution loop
  // **************************************************************************

  function exec(ctx) {
    if (null == ctx) {
      return(null);
    }

    while (true) {
      ctx.nextTokenCount = 8000;
      execCount += 1;

      var cb = ctx.callbacks.pop();
      if (null != cb) {
          if ( 0 !== execCount % ctx.resolution ) {
            // we call our callback function on the current context, assigning
            // the resulting context to `ctx`
            ctx = cb(ctx);
            // if we were returned a null context, this means that we
            // need to stop execution and break out of our loop.
            if ( null == ctx ) break;
          } else {
            // isNode
              // We're Node.JS, so we use the much quicker nextTick primitive.
            //  ? process.nextTick( function() { exec(cb(ctx)) } )
              // By default, nextTick calls setTimeout, but can be overriden
              // with other methods.
            //  : rawrEnv.nextTick( cb(ctx) );
              setImmediate( function() { exec(cb(ctx))});
            // As we're passing the context to a nextTick function, we break
            // on executing the current context, effectively passing control
            // to whatever picks up the context.
            break
          }
      } else {
        // We were returned a null context, so we stop execution.
        return(ctx);
      }
    }
    // Everything halted, so return the context.
    return(ctx);
  }
  rawrEnv.exec = exec;

  // given a quotation token, wrap it and return a JavaScript function that
  // executes the quotation itself, accepting a context.  The function returned
  // is a valid RawrCat token with an assigned value.
  var createQuotationFn = function(token) {
    var qnFn = function(ctx) {
      return( rawrEnv.executeQuotation( ctx, token ) );
    };
    qnFn.value = token;
    return(qnFn);
  };
  rawrEnv.createQuotationFn = createQuotationFn;

  // The heart and soul of the execution cycle of RawrCat -- given a context,
  // a token is popped off the token stream, and evaluated based on the token
  // type.  Continued execution is ensured by injecting nextToken into the
  // callback stream; when the token completes being evaluated, nextToken
  // is automatically called by the main execution loop that goes through
  // the callbacks.
  var nextToken = function(ctx) {
    // We were passed a null context, so we simply return, halting
    // execution.
    if ( null == ctx ) return ctx;
    // Fetch our token to execute off the token stream.  Note that the token
    // stream had reverse() apply, for performance reasons.
    var token = ctx.tokens.pop();
    // To ensure that we don't hit a recursion depth limit when nextToken()
    // calls nextToken() directly for optimization reasons.
    if ( 0 === ctx.nextTokenCount ) {
      // We simply push ourself onto the callback queue, and return the context;
      // this causes a reset of the recursion depth, and we're right back
      // where we were when nextToken is called.
      ctx.callbacks.push( nextToken );
      return(ctx);
    } else {
      --ctx.nextTokenCount;
    }
    if ( null != token ) {
      // We got a token when we pop()'ed the token stream.
      tokenCount += 1;
      // Local var declarations are faster than doing an object property lookup.
      var tokenType = token.tokenType;
      // If we have trace enabled, invoke the tracer on the current state.
      ctx.trace && traceCtxState(token, ctx);
      // The token in question is actually a native JavaScript function,
      // so we push nextToken onto the callback stream, and invoke the token
      // directly.
      if ( "function" === typeof( token ) ) {
        ctx.callbacks.push( nextToken );
        return( token(ctx) );
      }
      switch( tokenType ) {
        // Not identified as any token type, so we push the token onto the
        // stack rather than executing it.  This ensures that JavaScript
        // native types are evaluated as appropriate such as Number or
        // String.
        case null:
          ctx.stack.push( token );
          return( nextToken(ctx) );
        // The token is a RawrCat function, so we do a lookup in the dictionary
        // for the function to execute and then run it on the context.
        case "RCFunction":
          ctx.callbacks.push( nextToken );
          if ( 'undefined' !== typeof token['value'] ) {
            return( words[token.value](ctx) )
          } else {
            throw( "NonexistentWord:" + token.value );
          }
        // A quotation is essentially a function block; we push it onto
        // the stack as is, but wrap it in a JavaScript function.
        case "RCQuotation":
          ctx.stack.push( createQuotationFn( token ) );
          return(nextToken(ctx));
        // Special static token types.
        case "RCStack":
        case "RCChannel":
        case "RCPubSub":
          ctx.stack.push( token );
          return(nextToken(ctx));
        // We've fallen this far -- we're a valid token, but we don't know
        // how to handle it.  So we push the value stored on the token object.
        default:
          ctx.stack.push( token.value );
          return(nextToken(ctx));
      }
    } else {
      return(ctx);
    }
  };
  rawrEnv.nextToken = nextToken;

  // Our outer interpreter that starts execution, given a quotation.  A
  // quotation is its own context, so a new context object is created that
  // shares many attributes of the calling context, but has its own token
  // stream.
  rawrEnv.executeQuotation = function(ctx, quotation) {
    var newCtx = { stack: ctx.stack,
                   trace: ctx.trace,
                   depth: ctx.depth + 1,
                   // We turn the quotation into a token stream.  slice(0)
                   // ensures that we're operating upon a copy of the quotation
                   // rather than a reference to the quotation itself.
                   tokens: quotation.isArray
                              ? quotation.slice(0)
                              : quotation.value.slice(0),
                   callbacks: [],
                   executed: [],
                   resolution: ctx.resolution,
                   terminal: ctx.terminal,
                   thread: ctx.thread,
                   nextTokenCount: ctx.nextTokenCount };

    newCtx.trace && traceCtxState( newCtx.tokens, newCtx, true );

    // We leverage JavaScript closures in the following two functions.
    // Note that in all the following functions, we ignore any arguments.
    newCtx.callbacks.push( // 2. Return execution to the original quotation.
                           function() {
                            newCtx.trace && traceCtxState( newCtx.stack, ctx,
                                                           true );
                            return(ctx) },
                           // 1. We switch to the new context by calling
                           //    nextToken on it.
                           function() { return( nextToken(newCtx) ); } );

    // We return control to execute() which will then loop over the three
    // functions above that we pushed onto the callback stack.
    return(newCtx);
  };

  // **************************************************************************
  // rendering routines to turn stack, tokens, and elements into strings
  // for user representation and output -- also useful for serialization of
  // rawrcat programs and data structures
  // **************************************************************************

  // render an element and recursively render subelements into a string
  var renderElement = function(element, topIsNotList) {
    if ( element === null) {
      return( "null" );
    } else if ( element.hasOwnProperty('value') ) {
      switch ( element.tokenType ) {
        case "RCString":
          return( '"' + element.value + '"' );
        case "RCFunction":
          return( element.value );
        case "RCQuotation":
          var quotationElements = [];
          for (var i=0; i<element.value.length; i++) {
             quotationElements.push( renderElement( element.value[i] ) );
          }
          quotationElements.reverse();
          return( "[" + quotationElements.join(" ") + "]" );
        case "RCStack":
          return( element.value );
        case "RCChannel":
          return( element.value );
      }
      if ( element instanceof Function ) {
        var castedValue = "" + element.value;
        if ( castedValue === "[object Object]" ) {
          return( renderElement( element.value ) );
        } else {
          return( castedValue );
        }
      }
      return( renderElement( element.value ) );
    } else if ( element.tokenType == "RCHash" ) {
      var keyvals = element.keyvals();
      var hashStrings = [];
      for (var i=0; i<keyvals.length; i++) {
        hashStrings.push( "[" + renderElement(keyvals[i][0]) + " " +
          renderElement(keyvals[i][1]) + "] list" );
      }
      return( "[" + hashStrings.join(" ") + "] list hash" )
    } else if ( !element.isArray ) {
      if ( typeof( element ) === "string" ) {
        return( '"' + element + '"' );
      }
      return( element );
    }
    var reportSt = [];
    for (var x=0; x < element.length; x++) {
      var subElement = element[x];
      reportSt.push( renderElement( subElement ) );
    }
    if ( topIsNotList ) {
      return( "[" + reportSt.join( " " ) + "]" );
    } else if ( reportSt.length > 2 ) {
      return( "[" + reportSt.join( " " ) + "] list" );
    } else if ( reportSt.length === 2 ) {
      return( reportSt.join( " ") + " pair" );
    } else if ( reportSt.length === 1 ) {
      return( [ reportSt[0], "unit" ].join( " " ) );
    } else {
      return( "nil" )
    }
  };
  rawrEnv.renderElement = renderElement;

  // given the current 'token' and context, render it into a human repesentable
  // string that shows the state.
  var traceCtxState = function(token, ctx, showNoToken) {
    if (!ctx.trace) {
      return
    }

    var screenWidth;
    if (null != ctx.terminal) {
      screenWidth = ctx.terminal.cols;
    } else {
      screenWidth = 160;
    }

    var threadStr = '';
    var threadLen = 0;
    if (null != ctx.thread ) {
      threadStr = ctx.thread + ':';
      threadLen = threadStr.length;
    }

    // knob constants
    var minCountWidth = 9;
    var paddingLength = 3;
    var midPointPercent = .60;
    var midPointString = " --> ";
    var ellideString = "...";
    var spacer = " ";

    // begin our sizing calculations
    var rtIndent = Math.ceil( screenWidth * midPointPercent )
                      - midPointString.length;
    var tokenCountLen = tokenCount.toString().length;
    if ( tokenCountLen < minCountWidth ) {
      tokenCountLen = minCountWidth;
    }
    var prefixLen = minCountWidth - tokenCountLen - threadLen;
    var numIndentSpaces = ctx.depth + prefixLen;
    var reportStr = threadStr + tokenCount + ":";
    if ( numIndentSpaces > 0 ) {
      reportStr += Array(numIndentSpaces).join(" ");
    }

    var tokensRender = renderElement(ctx.tokens, true).toString();
    var tokenRender = renderElement(token, true).toString();

    var tokensMaxWidth;
    var tokenMaxWidth;
    if ( showNoToken === true ) {
      tokensMaxWidth = rtIndent - reportStr.length
                                - midPointString.length
                                - paddingLength;
    } else if ( ( tokensRender.length + tokenRender.length )
                > ( rtIndent - reportStr.length - ( paddingLength * 2 ) ) ) {
      if ( tokenRender.length > ( ( rtIndent - reportStr.length ) / 2 ) ) {
        tokenMaxWidth = ( rtIndent - reportStr.length ) / 2
                         - ellideString.length
                         - spacer.length;
        tokensMaxWidth = ( rtIndent - reportStr.length ) / 2
                         - ellideString.length
                         - paddingLength
                         - spacer.length;
      } else {
        tokenMaxWidth = tokenRender.length;
        tokensMaxWidth = rtIndent - reportStr.length
                                  - tokenMaxWidth
                                  - ellideString.length
                                  - paddingLength
                                  - spacer.length;
      }
    } else {
      tokenMaxWidth = tokenRender.length;
      tokensMaxWidth = tokensRender.length;
    }

    if ( ( tokenRender.length ) > tokenMaxWidth ) {
      tokenRender = tokenRender.slice( 0, tokenMaxWidth ) + spacer
                                                          + ellideString;
    }

    if ( ( tokensRender.length ) > tokensMaxWidth ) {
      tokensRender = ellideString + spacer + tokensRender.slice(
                                                        tokensRender.length
                                                        - tokensMaxWidth
                                                        + ellideString.length
                                                        + spacer.length,
                                                        tokensRender.length );
    }

    reportStr += "| " + tokensRender;

    if ( showNoToken === true ) {
      reportStr += Array(rtIndent
                         - reportStr.length ).join(" ");
    } else if ( reportStr.length < rtIndent - tokenRender.length ) {
      reportStr += Array(rtIndent
                         - reportStr.length
                         - tokenRender.length ).join(" ")
                         + tokenRender;
    } else {
      reportStr += tokenRender;
    }

    reportStr +=  midPointString;
    var renderedStack = renderElement( clone(ctx.stack).reverse(),
                                       true ).toString();
    if ( renderedStack.length + reportStr.length > screenWidth ) {
      renderedStack = renderedStack.slice( 0, screenWidth - reportStr.length
                                                          - ellideString.length
                                                          - spacer.length );
      renderedStack += spacer + ellideString;
    }
    reportStr += renderedStack;

    console.log( reportStr );
  };

  // render the stack into a string
  rawrEnv.renderStack = function(stack) {
    return( renderElement( stack ) )
  };

  return(rawrEnv);
};

// ****************************************************************************
// Initialization and bootstrap of RawrCat
// ****************************************************************************

var tokenCount = 0;
var execCount = 0;
//var resolution = 2500000;

rawr = rawrcat();
importJSLibrary("vendor/setImmediate.js");

// compiler - compiler, tokenizer, parser module
importJSLibrary("js/compiler.js");
// rawrtick - improved yield/timeout over JS native setTimeout
//importJSLibrary("js/rawrtick.js");
// threads - coroutine/threads
importJSLibrary("js/threads.js");
// channels - coroutine/thread communications 
importJSLibrary("js/channels.js");
// rawtest - test cases
importJSLibrary("js/rawrtest.js");
// rpc - rpc to a remote rawrcat server
importJSLibrary("js/rpc.js");


// Our REPL functions for node.js
function parseInput(data) {
    rawr.execute(ctx, data);
    process.stdout.write(">> ");
}

function prompt(ctx, callback) {
    process.stdout.write(">> ");
    process.stdin.on('data', function(data) {
        data = data.toString().trim();
        callback(data);
    });
}

// If we're node.js, we initialize a REPL -- otherwise, if we're a browser
// environment, we look for script tags with 'text/rawrcat' as a type in our
// DOM to execute.
if (isNode) {
  var ctx = rawr.createContext();
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  prompt(ctx, parseInput);
} else {
  // Filter all <script> tags in the DOM for the desired scriptType, and return
  // as a list of strings.
  function findLang(scripts, scriptType) {
    var code = [];
    for (var i=0; i<scripts.length; ++i) {
      if (scripts[i].type.toLowerCase()==scriptType) {
        code.push(scripts[i].text);
      }
    }
    return(code);
  }

  // Given a scriptType, search the DOM for scripts, filter according to
  // scriptType, and execute the RawrCat code found.
  function runAll(scriptType, callback) {
    var scripts = document.getElementsByTagName("script");
    if (scripts.length > 0) {
      var scriptParentNode = scripts[0].parentNode;
      var code = findLang(scripts, scriptType);
      for (var i=0; i<code.length; ++i) {
        callback(code[i]);
      }
    }
  }

  // Once the DOM's initialized and ready, we start executing RawrCat code
  // found there.
  $(document).ready(function () {
    var ctx = rawr.createContext();

    runAll("text/rawrcat", function(code) {
      rawr.execute(ctx, code);
    })});
}
