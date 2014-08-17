// ============================================================================
// RawrCat tokenizer, parser, and compiler module
// ============================================================================

var rawrCompiler = function(rawrEnv) {
  var rawrWhitespace = [ ' ', '\r', '\n', '\t' ];

  // *************************************************************************
  // Our token objects used for the tokenizer
  // *************************************************************************

  var RCToken = function( tokenType, tokenBegin, tokenEnd, tokenValue ) {
    tokenObj = new Object();
    tokenObj.tokenType = tokenType;
    tokenObj.begin = tokenBegin;
    tokenObj.end = tokenEnd;
    tokenObj.value = tokenValue;
    return( tokenObj );
  }

  var RCWhiteSpace = function( tokenBegin, tokenEnd, tokenValue ) {
    tokenObject = RCToken( "RCWhitespace", tokenBegin, tokenEnd, tokenValue );
    return( tokenObject );
  }

  var RCComment = function( tokenBegin, tokenEnd, tokenValue ) {
    tokenObject = RCToken( "RCComment", tokenBegin, tokenEnd, tokenValue );
  }

  var RCString = function( tokenBegin, tokenEnd, tokenValue ) {
    tokenObject = RCToken( "RCString", tokenBegin, tokenEnd, tokenValue );
    return( tokenObject );
  }

  var RCFloat = function( tokenBegin, tokenEnd, tokenValue ) {
    tokenObject = RCToken( "RCFloat", tokenBegin, tokenEnd, tokenValue );
    return( tokenObject );
  }

  var RCInteger = function( tokenBegin, tokenEnd, tokenValue ) {
    tokenObject = RCToken( "RCInteger", tokenBegin, tokenEnd, tokenValue );
    return( tokenObject );
  }

  var RCBeginQuotation = function( tokenBegin, tokenEnd, tokenValue ) {
    tokenObject = RCToken( "RCBeginQuotation", tokenBegin, tokenEnd,
                                               tokenValue );
    return( tokenObject );
  }

  var RCEndQuotation = function( tokenBegin, tokenEnd, tokenValue ) {
    tokenObject = RCToken( "RCEndQuotation", tokenBegin, tokenEnd,
                                             tokenValue );
    return( tokenObject )
  }

  var RCFunction = function( tokenBegin, tokenEnd, tokenValue ) {
    tokenObject = RCToken( "RCFunction", tokenBegin, tokenEnd,
                                         tokenValue );
    return( tokenObject );
  }

  var RCQuotation = function( tokenBegin, tokenEnd, tokenValue ) {
    tokenObject = RCToken( "RCQuotation", tokenBegin, tokenEnd,
                                          tokenValue );
    return( tokenObject );
  }

  var RCChannel = function( tokenBegin, tokenEnd, tokenValue ) {
    tokenObject = RCToken( "RCChannel", tokenBegin, tokenEnd,
                                        tokenValue );
    return ( tokenObject );
  }

  var RCStack = function( tokenBegin, tokenEnd, tokenValue ) {
    tokenObject = RCToken( "RCStack", tokenBegin, tokenEnd,
                                      tokenValue );
    return ( tokenObject );
  }

  var RCPubSub = function( tokenBegin, tokenEnd, tokenValue ) {
    tokenObject = RCToken( "RCPubSub", tokenBegin, tokenEnd,
                                       tokenValue );
    return ( tokenObject );
  }

  // *************************************************************************
  // Tokenizer state machine object
  // *************************************************************************

  var TokenizerData = function(input) {
    dataObj = new Object();

    dataObj.rawData = input;
    dataObj.currPos = -1;
    dataObj.tokens = [];
    dataObj.parsed = [];
    dataObj.currChr = "";

    dataObj.addToken = function(token) {
      this.tokens.push(token);
      // console.log( token.tokenType, token.tokenValue )
    }

    dataObj.next = function(num) {
      if ( null == num ) {
        num = 1;
      }
      this.currPos += num;
      if ( this.currPos <= this.rawData.length ) {
        this.currChr = this.rawData.charAt(this.currPos);
      } else {
        throw("EndOfData");
      }
    }

    dataObj.peek = function() {
      return(this.rawData.charAt(this.currPos+1));
    }

    dataObj.seek = function(idx) {
      this.currPos = idx;
      this.currChr = this.rawData.charAt(this.currPos);
    }

    dataObj.seekNext = function( chrs ) {
      var nextChrPos = this.rawData.indexOf(chrs, this.currPos + 1);
      if ( nextChrPos < 0 ) { 
        throw("EndOfData");
      } else {
        this.currPos = nextChrPos + chrs.length;
        this.currChar = this.rawData.charAt(this.currPos);
      }
    }

    dataObj.posBeginWith = function( listStrings ) {
      var chunk = this.rawData.slice( this.currPos, this.currPos + chunkSize );
      for ( stringIdx in listStrings ) {
        var compString = listStrings[ stringIdx ];
        if ( compString === chunk.slice( 0, compString.length ) ) {
          this.next( compString.length );
          return( compString );
        }
      }
      return( null );
    }

    dataObj.getSlice = function( begin, end ) {
      var beginIsNull = ( null == begin );
      if ( beginIsNull ) {
        return( this.rawData[ this.currPos ] );
      } else if ( ( !beginIsNull ) && ( null != end ) ) {
        return( this.rawData.slice( begin, end ) )
      } else {
        return( this.rawData.charAt( begin ) )
      }
    }

    dataObj.insertSlice = function( sl, left, right ) {
      this.rawData = [ this.rawData.slice(0, left), sl,
                       this.rawData.slice(right,
                                          this.rawData.length + 1) ].join()
    }

    // initialize ourself before returning
    dataObj.next()

    return(dataObj);
  }

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
    }

    try {
      while(true) {
        //console.log( "CHR:", data.currChr );
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
          beginStringIdx = data.currPos
          endStringIdx = null
          //var stringChr = data.currChr
          while( null == endStringIdx ) {
            data.next()
            if ( data.currChr === '"' ) {
              data.next()
              endStringIdx = data.currPos
            }
          }
          data.addToken( RCString( beginStringIdx, endStringIdx,
                                   data.getSlice( beginStringIdx+1,
                                                  endStringIdx-1 ).toString() ) );
        } else if ( data.currChr === "(" ) {
          flushToken();
          beginCommentIdx = data.currPos;
          endCommentIdx = null;
          data.seekNext( ")" );
          data.next();
        } else if ( data.currChr === "[" ) {
          flushToken();
          quotationDepth += 1
          data.addToken( RCBeginQuotation( data.currPos, data.currPos,
                                           quotationDepth, "[" ) );
          data.next()
        } else if ( data.currChr === "]" ) {
          flushToken();
          if ( quotationDepth === 0 ) {
            throw( "UnbalancedQuotation" )
          }
          data.addToken( RCEndQuotation( data.currPos, data.currPos,
                                         quotationDepth, "]" ) );
          quotationDepth -= 1
          data.next()
        } else if ( data.currChr === "#" ) {
          flushToken();
          isChannel = true;
          data.next();
        } else if ( data.currChr === "@" ) {
          flushToken();
          isStack = true;
          data.next();
        } else if ( data.currChr === "$" ) {
          flushToken();
          isPubSub = true;
          data.next();
        } else if ( null == tokenBegin ) {
          tokenBegin = data.currPos
          data.next()
        } else {
          data.next()
        }
      }
    } catch (e) {
      if ( e == "EndOfData" ) {
        flushToken();
        if( quotationDepth > 0 ) {
          throw( "UnterminatedQuotation" )
        } else {
          //console.log(data);
          return(data)
        }
      } else {
        throw( e )
      }
    }
  }


  // *************************************************************************
  // Parser state machine object
  // *************************************************************************
  var ParserData = function(tokenData) {
    dataObj = new Object();
    dataObj.tokenizerData = tokenData;
    dataObj.tokens = tokenData.tokens;
    dataObj.currPos = -1;
    dataObj.currToken = undefined;

    dataObj.next = function( num ) {
      if ( null == num ) {
        num = 1;
      }
      this.currPos += num;
      if ( this.currPos <= this.tokens.length ) {
        this.currToken = this.tokens[ this.currPos ];
      } else {
        throw("EndOfData");
      }
    }

    dataObj.peek = function( num ) {
      if ( null == num ) {
        num = 1;
      }
      return( this.tokens[ this.currPos + num ] );
    }

    dataObj.seek = function( num ) {
      if ( null == num ) {
        num = 0;
      }
      this.currPos = num;
      this.currToken = this.tokens[ this.currPos ];
      return( this.currToken );
    }

    dataObj.seekNext = function( tokenType ) {
      while( true ) {
        if( this.currToken.tokenType === tokenType ) {
          return( self.currPos );
        } else {
          self.next();
        }
      }
    }

    // initialize before moving on
    dataObj.next();
    return( dataObj );

  }

  // given an token state object, produce a quotation object suitable for
  // execution by the interpreter
  rawrEnv.parse = function(inputTokenData) {
    var parserData = ParserData(inputTokenData);
    var parsed = null;

    var parseQuotation = function(begin) {
      var quotationTokens = [];
      var currToken = null;
      var endToken = 0;
      var end = 0;
      while( true ) {
        currToken = parserData.currToken;
        if( typeof(currToken) === 'undefined' ) {
          endToken = parserData.peek(-1)
          if ( null != endToken ) {
            end = endToken.end;
          }
          return( RCQuotation( begin, end,
                               quotationTokens ) );
        }
        if ( currToken.tokenType === "RCBeginQuotation" ) {
          parserData.next();
          quotationTokens.push( parseQuotation( currToken.begin ) );
        } else if ( currToken.tokenType === "RCEndQuotation" ) {
          parserData.next();
          return( RCQuotation( begin, currToken.end, quotationTokens ) );
        } else {
          quotationTokens.push( currToken );
          parserData.next();
        }
      }
    }
    parsed = parseQuotation(0);
    parsed.tokenCount = parserData.tokens.length;
    return( parsed );
  }

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
      if ( token.tokenType === "RCQuotation" )  {
        compiledToken = rawrEnv.compile( token );
        token.value = compiledToken;
        outTokens.push( token );
      } else if ( token.tokenType === "RCFunction" ) {
        var func = rawrEnv.words[token.value];
        if (func == null) {
          outTokens.push( token );
        } else {
          func.value = token.value
          outTokens.push( func );
        }
      } else {
        outTokens.push( token );
      }
    }
    return( outTokens );
  }

  return( rawrEnv );
}


rawrCompiler(rawr);