// ****************************************************************************
// test case module
// ****************************************************************************

var rawrTest = function(rawrEnv) {
  var testCases = {
    'vmwarmup': [ "1 2 mul 3 add 4 sub 10 mod [ 1 + ] apply", [ 2 ] ],
    'add': [ "2 5 +", [ 7 ] ],
    'div': [ "12 6 div", [ 2 ] ],
    'mul': [ "5 3 mul", [ 15 ] ],
    'sub': [ "5 3 sub", [ 2 ] ],
    'mod': [ "5 3 mod", [ 2 ] ],
    'neg': [ "10 neg", [ -10 ] ],
    'false': [ "false", [ false ] ],
    'true': [ "true", [ true ] ],
    'not': [ "true not", [ false ] ],
    'and': [ 'false true and', [ false ] ], 
    'pop': [ "1 2 3 pop", [ 1, 2 ] ],
    'popd': [ "1 2 3 popd", [ 1, 3 ] ],
    'swap': [ "1 2 3 swap", [ 1, 3, 2 ] ],
    'inc': [ "10 inc", [ 11 ] ],
    'nil': [ "nil", [ [] ] ],
    'null': [ "null", [ null ] ],
    'empty': [ "nil empty", [ [], true ] ],
    'apply': [ "1 [2 +] apply", [ 3 ] ],
    'dip': [ "1 [1 2 +] dip", [ 3, 1 ] ],
    'quote': [ "10 quote apply", [ 10 ] ],
    'list': [ "[1 2 3] list", [ [ 1, 2, 3 ] ] ],
    'pair': [ "1 2 pair", [ [ 1, 2 ] ] ],
    'unit': [ "1 2 unit", [ 1, [ 2 ] ] ],
    'head': [ "[1 2 3] list head", [ 3 ] ],
    'first': [ "[1 2 3] list first", [ [ 1, 2, 3 ], 3 ] ],
    'rest': [ "[1 2 3] list rest", [ [ 1, 2 ] ] ],
    'tail': [ "[1 2 3] list tail", [ [ 1, 2, 3 ], [ 1, 2 ] ] ],
    'count': [ "[1 2 3 10] list count", [ [ 1, 2, 3, 10 ], 4] ],
    'dup': [ "5 dup", [ 5, 5 ] ],
    'cons': [ "[1 2 3] list 4 cons", [ [ 1, 2, 3, 4 ] ] ],
    'uncons': [ "[1 2 3] list uncons", [ [ 1, 2 ], 3 ] ],
    'compose': [ "[1 2] [3 +] compose apply", [ 1, 5 ] ],
    'if': [ "true [12] [13] if", [ 12 ] ],
    'eq': [ "5 3 eq", [ false ] ],
    'neq': [ "5 3 neq", [ true ] ],
    'gt': [ '5 3 gt', [ true ] ],
    'gteq': [ '3 3 gteq', [ true ] ],
    'lt': [ '3 5 lt', [ true ] ],
    'while': [ '1 [2 mul] [dup 100 lteq] while', [ 128 ] ],
    'foreach': [ "0 [1 2 3] list [add] foreach", [ 6 ] ],
    'fold': [ "[1 2 3 4] list 0 [add] fold", [ 10 ] ],
    'define': [ "define testcase [ 1 2 + ] testcase", [3] ],
    'hash': [ '[["a" 1] list ["b" 2] list] list hash',
                  [ OrderedHash( [ [ 'a', 1 ], [ 'b', 2 ] ] ) ] ],
    'hash_to_list': [ '["a" 1 pair] list hash hash_to_list',
                  [ [ [ "a", 1 ] ] ] ],
    'hash_set': [ 'nil hash 1 "a" hash_set',
                  [ OrderedHash( [ [ 'a', 1 ] ] ) ] ],
    'hash_get': [ '["a" 1 pair] list hash "a" hash_get swap pop',
                  [ 1 ] ],
    'hash_contains': [ '["a" 1 pair] list hash "a" hash_contains swap \
                         "b" hash_contains',
                  [ true, OrderedHash( [ [ 'a', 1 ] ] ), false ] ],
    'hash_safe_get': [ '["a" 1 pair] list hash "a" false hash_safe_get swap \
                         "b" true hash_safe_get',
                  [ 1, OrderedHash( [ [ 'a', 1 ] ] ), true] ],
    'from_json': [ '"[1, 2, 3]" from_json', [ [ 1, 2, 3 ] ] ],
    'to_json': [ '[1 2 3] list to_json', [ "[1,2,3]" ] ],
    'from_string': [ '"[1 2 3 [4 5] list] list" from_string',
                        [ [ 1, 2, 3, [ 4, 5 ] ] ] ],
    'to_string': [ '[1 2 3 [4 5] list] list to_string swap pop',
                    [ "[1 2 3 4 5 pair] list" ] ],
    'compile_fib': [ "define fib [ dup 1 <= []\
                                  [ dup 1 - fib swap 2 - fib +] if ]", [] ],
    'fib': [ "8 fib", [ 21 ] ],
    'clear_stack': [ '1 2 3 clear_stack', [] ],
    'thread_channel': [ '#test create_channel\
                         [ [ #test -> #test <- ] forever ]\
                           "thread_channel" nil thread\
                         1 [2 mul #test <- #test ->] [ dup 100 lteq ] while\
                         stop-threads',
                         [ 128 ] ]
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
      var numIter = 500000;
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
        var testFn = testCase[0]
        var expectedResult = [ testCase[1] ]

        var testFn = "[clear_stack [" + testFn + "] list ] " + numIter + " repeat"

        var tokenizedFn = rawr.tokenize( testFn );
        var parsedFn = rawr.parse( tokenizedFn );
        var compiledFn = rawr.compile( parsedFn );

        var currIter = 0;
        var start = new Date().getTime();

        var runTest = function(ctx, parsed) {
          var executeTest = function () {
            return( rawrEnv.executeQuotation( ctx, parsed ) ) }

          // Set up to check our results after the test is done.
          ctx.callbacks.push( checkResults );
          // Add our actual test to the dispatch queue.
          ctx.callbacks.push( executeTest );
          // Finally, kick it all off.
          rawrEnv.exec( ctx );
        }

        var checkResults = function(ctx) {
          var end = new Date().getTime();
          if ( rawrEnv.renderElement(expectedResult)
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
        }

        runTest(ctx, parsedFn);
      }

    var nextTest = function(ctx) {
      test = testsToDo.pop()
      if ( test ) {
        doTestCase( test, ctx );
      } else {
        ctx.trace = oldTrace
        ctx.resolution = oldResolution
      }
    }

    // Finally, start our test loop.
    nextTest(ctx);
  }
  rawrEnv.words['test'] = rawrEnv.runTestCase;
  rawrEnv.words['test-one'] = rawrEnv.runSingleTestCase;
  return( rawrEnv );
}

rawrTest(rawr);