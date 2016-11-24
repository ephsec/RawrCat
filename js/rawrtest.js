// ****************************************************************************
// test case module
// ****************************************************************************

var rawrTest = function(rawrEnv) {
  var testCases = {
    'vmwarmup': [ "1 2 mul 3 add 4 sub 10 mod [ 1 + ] apply", "2 unit" ],
    'add': [ "2 5 +", "7 unit" ],
    'div': [ "12 6 div",  "2 unit" ],
    'mul': [ "5 3 mul", "15 unit" ],
    'sub': [ "5 3 sub", "2 unit"],
    'mod': [ "5 3 mod", "2 unit"],
    'neg': [ "10 neg", "-10 unit" ],
    'false': [ "false", "false unit" ],
    'true': [ "true", "true unit" ],
    'not': [ "true not", "false unit" ],
    'and': [ 'false true and', "false unit" ],
    'pop': [ "1 2 3 pop", "1 2 pair" ],
    'popd': [ "1 2 3 popd", "1 3 pair" ],
    'swap': [ "1 2 3 swap", "[1 3 2] list" ],
    'inc': [ "10 inc", "11 unit" ],
    'nil': [ "nil", "nil unit" ],
    'null': [ "null", "null unit" ],
    'empty': [ "nil empty", "nil true pair" ],
    'apply': [ "1 [2 +] apply", "3 unit" ],
    'dip': [ "1 [1 2 +] dip", "3 1 pair" ],
    'quote': [ "10 quote apply", "10 unit" ],
    'list': [ "[1 2 3] list", "[1 2 3] list unit" ],
    'pair': [ "1 2 pair", "1 2 pair unit" ],
    'unit': [ "1 2 unit", "1 2 unit pair" ],
    'head': [ "[1 2 3] list head", "3 unit" ],
    'first': [ "[1 2 3] list first", "[1 2 3] list 3 pair" ],
    'rest': [ "[1 2 3] list rest", "1 2 pair unit" ],
    'tail': [ "[1 2 3] list tail", "[1 2 3] list 1 2 pair pair" ],
    'count': [ "[1 2 3 10] list count", "[1 2 3 10] list 4 pair" ],
    'dup': [ "5 dup", "5 5 pair" ],
    'cons': [ "[1 2 3] list 4 cons", "[1 2 3 4] list unit" ],
    'uncons': [ "[1 2 3] list uncons", "1 2 pair 3 pair" ],
    'compose': [ "[1 2] [3 +] compose apply", "1 5 pair" ],
    'if': [ "true [12] [13] if", "12 unit" ],
    'eq': [ "5 3 eq", "false unit" ],
    'neq': [ "5 3 neq", "true unit" ],
    'gt': [ '5 3 gt', "true unit" ],
    'gteq': [ '3 3 gteq', "true unit" ],
    'lt': [ '3 5 lt', "true unit" ],
    'while': [ '1 [2 mul] [dup 100 lteq] while', "128 unit" ],
    'foreach': [ "0 [1 2 3] list [add] foreach", "6 unit" ],
    'fold': [ "[1 2 3 4] list 0 [add] fold", "10 unit" ],
    'repeat': [ "[1 2 +] 5 repeat", "[3 3 3 3 3] list" ],
    'define': [ "define testcase [ 1 2 + ] testcase", "3 unit" ],
    'hash': [ '[["a" 1] list ["b" 2] list] list hash',
                  '[["a" 1] list ["b" 2] list] list hash unit' ],
    'hash_to_list': [ '["a" 1 pair] list hash hash_to_list',
                  '"a" 1 pair unit unit' ],
    'hash_set': [ 'nil hash 1 "a" hash_set',
                  '[["a" 1] list] list hash unit' ],
    'hash_get': [ '["a" 1 pair] list hash "a" hash_get swap pop',
                  "1 unit" ],
    'hash_contains': [ '["a" 1 pair] list hash "a" hash_contains swap \
                         "b" hash_contains',
                  '[true [["a" 1] list] list hash false] list' ],
    'hash_safe_get': [ '["a" 1 pair] list hash "a" false hash_safe_get swap \
                         "b" true hash_safe_get',
                  '[1 [["a" 1] list] list hash true] list' ],
    'from_json': [ '"[1, 2, 3]" from_json', "[1 2 3] list unit"],
    'to_json': [ '[1 2 3] list to_json', '"[1,2,3]" unit' ],
    'from_string': [ '"[1 2 3 [4 5] list] list" from_string',
                        "[1 2 3 4 5 pair] list unit" ],
    'to_string': [ '[1 2 3 [4 5] list] list to_string swap pop',
                    '"[1 2 3 4 5 pair] list" unit' ],
    'compile_fib': [ "define fib [ dup 1 <= []\
                                  [ dup 1 - fib swap 2 - fib +] if ]", "nil" ],
    'fib': [ "8 fib", "21 unit" ],
    'clear_stack': [ '1 2 3 clear_stack', "nil" ],
    'thread_channel': [ '#test create_channel\
                         [ [ #test -> #test <- ] forever ]\
                           "thread_channel" nil thread\
                         1 [2 mul #test <- #test ->] [ dup 100 lteq ] while\
                         stop-threads',
                         "128 unit" ]
//    'rand_rect': [ '"canvas" get_canvas\
//                     0 255 rand 0 255 rand 0 255 rand set_color\
//                     0 800 rand 0 600 rand 0 800 rand 0 600 rand fill_rect',
//                    [document.getElementById("canvas").getContext('2d')] ]

  }

  // check our integrity
  rawrEnv.runSingleTestCase = function(ctx) {
    return(rawrEnv.runTestCase(ctx, ctx.stack.pop()));
  }

  rawrEnv.runTestCase = function(ctx, testCase) {
      var numBatches = 20;
      var numIterBatch = 100000;
      var numIter = numBatches * numIterBatch;
      var testsToDo = [];

      if ( null == testCase ) {
        for ( test in testCases ) {
          testsToDo.push( test ); 
        }
        testsToDo.reverse();
      } else {
        testsToDo = [ testCase ];
      }

      var oldTrace = ctx.trace;
      var oldResolution = ctx.resolution;
      ctx.trace = false;
      ctx.resolution = 2500000;

      var doTestCase = function( test, ctx ) {
        var testCase = testCases[ test ];
        var testFn = testCase[0];
        var expectedResult = [ testCase[1] ];

        var batchIter = 0;
        var unrolledTestFn = "";

        while (batchIter < numIterBatch) {
           unrolledTestFn += "clear_stack " + testFn + " ";
           batchIter += 1;
        }

        // var testFn = "[clear_stack [" + testFn + "] list ] " + numIter + " repeat";

        var tokenizedFn = rawr.tokenize( unrolledTestFn );
        var parsedFn = rawr.parse( tokenizedFn );
        var compiledFn = rawr.compile( parsedFn );


        var runTest = function(ctx, parsed) {
          var executeTest = function () {
            return( rawrEnv.executeQuotation( ctx, parsed ) ) };

          // Set up to check our results after the test is done.
          ctx.callbacks.push( checkResults );
          // Add our actual test to the dispatch queue.
          for(var i=0; i < numBatches; i++) {
            ctx.callbacks.push( executeTest );
          }
          // Finally, kick it all off.
          rawrEnv.exec( ctx );
        };

        var start = new Date().getTime();

        var checkResults = function(ctx) {
          var end = new Date().getTime();
          if ( expectedResult
                == rawrEnv.renderElement(ctx.stack) ) {
            var opsPerMicrosecond =
              ( ( numIter /( end - start ) ) / 1000 ).toPrecision(5);
            var opsPerSecond =
              ( Math.round( ( numIter/ ( end - start ) ) * 1000) ) 
            console.log(
              [ "Test '", test, "' passed in ", ( end - start ),
                "ms (", opsPerMicrosecond,  " ops/us, ", opsPerSecond, 
                " ops/s)" ].join( "" ) );
          } else {
            console.log( "Test '"+ test + "' failed!" );
            console.log( "INPUT:", rawrEnv.renderElement( testCase[0] ) );
            console.log( expectedResult );
            console.log( "EXPECTED:", rawrEnv.renderElement( expectedResult ) );
            console.log( ctx.stack );
            console.log( "RESULT:", rawrEnv.renderElement( ctx.stack ) );
          }
          // Move on to the next test.
          ctx.callbacks.push( nextTest );
          return(ctx);
        };

        runTest(ctx, compiledFn);
      };

    var nextTest = function(ctx) {
      test = testsToDo.pop();
      if ( test ) {
        doTestCase( test, ctx );
      } else {
        ctx.trace = oldTrace;
        ctx.resolution = oldResolution;
      }
    };

    // Finally, start our test loop.
    nextTest(ctx);
  };
  rawrEnv.words['test'] = rawrEnv.runTestCase;
  rawrEnv.words['test-one'] = rawrEnv.runSingleTestCase;
  return( rawrEnv );
};

rawrTest(rawr);