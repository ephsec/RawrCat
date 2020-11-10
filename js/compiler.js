// ============================================================================
// RawrCat tokenizer, parser, and compiler module
// ============================================================================

var rawrCompiler = function(rawrEnv) {
  var rawrWhitespace = [ ' ', '\r', '\n', '\t' ];

  // *************************************************************************
  // Our token objects used for the tokenizer
  // *************************************************************************

  var RCToken = function( tokenType, tokenBegin, tokenEnd, tokenValue ) {
    return( { tokenType: tokenType,
              begin: tokenBegin,
              end: tokenEnd,
              value: tokenValue } );
  };

  var RCWhiteSpace = function( tokenBegin, tokenEnd, tokenValue ) {
    return( RCToken( "RCWhitespace", tokenBegin, tokenEnd, tokenValue ) )
  };

  var RCComment = function( tokenBegin, tokenEnd, tokenValue ) {
    return( RCToken( "RCComment", tokenBegin, tokenEnd, tokenValue ) )
  };

  var RCString = function( tokenBegin, tokenEnd, tokenValue ) {
    return( RCToken( "RCString", tokenBegin, tokenEnd, tokenValue ) )
  };

  var RCFloat = function( tokenBegin, tokenEnd, tokenValue ) {
    return( RCToken( "RCFloat", tokenBegin, tokenEnd, tokenValue ) )
  };

  var RCInteger = function( tokenBegin, tokenEnd, tokenValue ) {
    return( RCToken( "RCInteger", tokenBegin, tokenEnd, tokenValue ) )
  };

  var RCBeginQuotation = function( tokenBegin, tokenEnd, tokenValue ) {
    return( RCToken( "RCBeginQuotation", tokenBegin, tokenEnd, tokenValue ) )
  };

  var RCEndQuotation = function( tokenBegin, tokenEnd, tokenValue ) {
    return( RCToken( "RCEndQuotation", tokenBegin, tokenEnd, tokenValue ) )
  };

  var RCFunction = function( tokenBegin, tokenEnd, tokenValue ) {
    return( RCToken( "RCFunction", tokenBegin, tokenEnd, tokenValue ) );
  };

  var RCQuotation = function( tokenBegin, tokenEnd, tokenValue ) {
    return( RCToken( "RCQuotation", tokenBegin, tokenEnd, tokenValue ) )
  };

  var RCChannel = function( tokenBegin, tokenEnd, tokenValue ) {
    return( RCToken( "RCChannel", tokenBegin, tokenEnd, tokenValue ) )
  };

  var RCStack = function( tokenBegin, tokenEnd, tokenValue ) {
    return( RCToken( "RCStack", tokenBegin, tokenEnd, tokenValue ) )
  };

  var RCPubSub = function( tokenBegin, tokenEnd, tokenValue ) {
    return( RCToken( "RCPubSub", tokenBegin, tokenEnd, tokenValue ) )
  };

  // *************************************************************************
  // Tokenizer state machine object
  // *************************************************************************

  var TokenizerData = function(input) {
    var rawData = input;
    var currPos = -1;
    var tokens = [];
    var currChr = "";

    var addToken = function(token) {
      tokens.push(token);
    };

    var next = function(num) {
      if ( null == num ) {
        num = 1;
      }
      currPos += num;
      if ( currPos <= rawData.length ) {
        currChr = rawData.charAt(currPos);
      } else {
        throw("EndOfData");
      }
    };

    var peek = function() {
      return(rawData.charAt(dataObj.currPos+1));
    };

    var seek = function(idx) {
      currPos = idx;
      currChr = rawData.charAt(currPos);
    };

    var seekNext = function( chrs ) {
      var nextChrPos = rawData.indexOf(chrs, currPos + 1);
      if ( nextChrPos < 0 ) { 
        throw("EndOfData");
      } else {
        currPos = nextChrPos + chrs.length;
        currChr = rawData.charAt(dataObj.currPos);
      }
    };

    var posBeginWith = function( listStrings ) {
      var chunk = rawData.slice( dataObj.currPos, dataObj.currPos + chunkSize );
      for ( var stringIdx in listStrings ) {
        var compString = listStrings[ stringIdx ];
        if ( compString === chunk.slice( 0, compString.length ) ) {
          next( compString.length );
          return( compString );
        }
      }
      return( null );
    };

    var getSlice = function( begin, end ) {
      var beginIsNull = ( null == begin );
      if ( beginIsNull ) {
        return( rawData[ currPos ] );
      } else if ( ( !beginIsNull ) && ( null != end ) ) {
        return( rawData.slice( begin, end ) )
      } else {
        return( rawData.charAt( begin ) )
      }
    };

    var insertSlice = function( sl, left, right ) {
      rawData = [ rawData.slice(0, left), sl,
                  rawData.slice(right,
                                rawData.length + 1) ].join()
    };

    var dataObj =  { addToken: addToken,
                     next: next,
                     peek: peek,
                     seek: seek,
                     seekNext: seekNext,
                     posBeginWith: posBeginWith,
                     getSlice: getSlice,
                     insertSlice: insertSlice };

    Object.defineProperties( dataObj, {
      "currPos": { get: function () { return( currPos ) } },
      "currChr": { get: function () { return( currChr ) } },
      "tokens": { get: function () { return( tokens ) } }
    });

    // initialize ourself before returning
    dataObj.next();

    return(dataObj);
  };

  // Tokenizes a given input string into a token state object
  rawrEnv.tokenize = function(inputData) {
    var data = TokenizerData( inputData );
    var quotationDepth = 0;
    var tokenBegin = null;
    var beginStringIdx = null;
    var endStringIdx = null;
    var isChannel = false;
    var isStack = false;
    var isPubSub = false;

    var flushToken = function() {
      if ( null != tokenBegin ) {
        token = data.getSlice( tokenBegin, data.currPos );
        if ( token === "" ) {
          return;
        }
        if ( isChannel ) {
          data.addToken( RCChannel( tokenBegin, data.currPos, "#" + token ) );
        } else if ( isStack ) {
          data.addToken( RCStack( tokenBegin, data.currPos, "@" + token ) );
        } else if ( isPubSub ) {
          data.addToken( RCPubSub( tokenBegin, data.currPos, "$" + token ) );
        } else if ( isNaN(token) ) {
          data.addToken( RCFunction( tokenBegin, data.currPos,
                                     token ) );
        } else {
          if( token.indexOf('.') > 0 ) {
            data.addToken( RCFloat( tokenBegin, data.currPos,
                                    parseFloat(token) ) );
          } else {
            data.addToken( RCInteger( tokenBegin, data.currPos,
                                      parseInt(token) ) );
          }
        }
        tokenBegin = null;
        isChannel = false;
        isStack = false;
        isPubSub = false;
      }
    };

    try {
      while(true) {
        if ( rawrWhitespace.indexOf( data.currChr ) !== -1 ) {
          flushToken();
          beginStringIdx = data.currPos;
          endStringIdx = null;
          while( null == endStringIdx ) {
            data.next();
            if ( rawrWhitespace.indexOf( data.currChr ) === -1 ) {
              endStringIdx = data.currPos - 1;
            }
          }
          // data.addToken( RCWhiteSpace( beginStringIdx, endStringIdx,
          //                             data.getSlice( beginStringIdx,
          //                                            endStringIdx ) ) );
        } else if ( data.currChr === '"' ) {
          flushToken();
          beginStringIdx = data.currPos;
          endStringIdx = null;
          //var stringChr = data.currChr
          while( null == endStringIdx ) {
            data.next();
            if ( data.currChr === '"' ) {
              data.next();
              endStringIdx = data.currPos
            }
          }
          data.addToken( RCString( beginStringIdx, endStringIdx,
                                   data.getSlice( beginStringIdx+1,
                                                  endStringIdx-1 ).toString() ) );
        } else {
          switch ( data.currChr ) {
            case "(":
              flushToken();
              beginCommentIdx = data.currPos;
              endCommentIdx = null;
              data.seekNext( ")" );
              data.next();
              break;
            case "[":
              flushToken();
              quotationDepth += 1;
              data.addToken( RCBeginQuotation( data.currPos, data.currPos,
                  quotationDepth, "[" ) );
              data.next();
              break;
            case "]":
              flushToken();
              if ( quotationDepth === 0 ) {
                throw( "UnbalancedQuotation" );
              }
              data.addToken( RCEndQuotation( data.currPos, data.currPos,
                  quotationDepth, "]" ) );
              quotationDepth -= 1;
              data.next();
              break;
            case "#":
              flushToken();
              isChannel = true;
              data.next();
              break;
            case "@":
              flushToken();
              isStack = true;
              data.next();
              break;
            case "$":
              flushToken();
              isPubSub = true;
              data.next();
              break;
            default:
              if ( null == tokenBegin ) {
                tokenBegin = data.currPos;
                data.next();
              } else {
                data.next();
              }
          }
        }
      }
    } catch (e) {
      if ( e == "EndOfData" ) {
        flushToken();
        if( quotationDepth > 0 ) {
          throw( "UnterminatedQuotation" )
        } else {
          // console.log(data.tokens);
          return(data)
        }
      } else {
        throw( e )
      }
    }
  };


  // *************************************************************************
  // Parser state machine object
  // *************************************************************************
  var ParserData = function(tokenData) {
    var tokens = tokenData.tokens;
    var currPos = -1;
    var currToken = undefined;

    var next = function( num ) {
      if ( null == num ) {
        num = 1;
      }
      currPos += num;
      if ( currPos <= tokens.length ) {
        currToken = tokens[ currPos ];
      } else {
        throw("EndOfData");
      }
    };

    var peek = function( num ) {
      if ( null == num ) {
        num = 1;
      }
      return( tokens[ currPos + num ] );
    };

    var seek = function( num ) {
      if ( null == num ) {
        num = 0;
      }
      currPos = num;
      currToken = tokens[ currPos ];
      return( currToken );
    };

    var seekNext = function( tokenType ) {
      while( true ) {
        if( currToken.tokenType === tokenType ) {
          return( currPos );
        } else {
          next();
        }
      }
    };

    var dataObj = { next: next,
                    peek: peek,
                    seek: seek,
                    seekNext: seekNext };

    Object.defineProperties( dataObj, {
      "currToken": { get: function () { return( currToken ) } },
      "tokens": { get: function () { return( tokens ) } }
    });

    // initialize before moving on
    dataObj.next();
    return( dataObj );

  };

  // given an token state object, produce a quotation object suitable for
  // execution by the interpreter
  rawrEnv.parse = function(inputTokenData) {
    var parserData = ParserData(inputTokenData);
    var parsed;

    var parseQuotation = function(begin) {
      var currToken;
      var quotationTokens = [];
      var endToken = 0;
      var end = 0;
      while( true ) {
        currToken = parserData.currToken;
        if( typeof(currToken) === 'undefined' ) {
          endToken = parserData.peek(-1);
          if ( null != endToken ) {
            end = endToken.end;
          }
          quotationTokens.reverse();
          return( RCQuotation( begin, end,
                               quotationTokens ) );
        }
        if ( currToken.tokenType === "RCBeginQuotation" ) {
          parserData.next();
          quotationTokens.push( parseQuotation( currToken.begin ) );
        } else if ( currToken.tokenType === "RCEndQuotation" ) {
          parserData.next();
          quotationTokens.reverse();
          return( RCQuotation( begin, currToken.end, quotationTokens ) );
        } else {
          quotationTokens.push( currToken );
          parserData.next();
        }
      }
    };
    parsed = parseQuotation(0);
    parsed.tokenCount = parserData.tokens.length;
    return( parsed );
  };

  // optional compilation step that takes a quotation and recursively does
  // function call lookups, replacing RCFunction tokens with actual JavaScript
  // function calls.
  //
  // This gives a 10-30% speed boost on tight inner loops, but is marginal
  // otherwise and removes a lot of the debugging data.
  rawrEnv.compile = function(inputTokens) {
    var outTokens = [];
    var tokens = inputTokens.value;

    for ( var tokenIdx=0; tokenIdx < tokens.length; tokenIdx++ ) {
      var token = tokens[ tokenIdx ];
      //console.log( rawrEnv.renderElement( token ) );

      if ( token.tokenType === "RCQuotation" && token.compiled !== true )  {
        var compiledToken = rawrEnv.compile( token );
        compiledToken.compiled = true;
        token.value = compiledToken;
        outTokens.push( token );
      } else if ( token.tokenType === "RCFunction" ) {
        var func = rawrEnv.words[token.value];
        if (func == null) {
          outTokens.push( token );
        } else {
          func.value = token.value;
          outTokens.push( func );
        }
      } else {
        outTokens.push( token );
      }
    }
    return( outTokens );
  };
  return( rawrEnv );
};


rawrCompiler(rawr);
