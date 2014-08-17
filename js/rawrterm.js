var origConsole = console;
// var console = { log: function() {} };

function RawrConsole() {
  var rawrConsole = {};
  rawrConsole.createTerminal = function(ctx) {
    var height = ctx.stack.pop();
    var width = ctx.stack.pop();
    var termDiv = ctx.stack.pop();

    jQuery(function($, undefined) {
      var inputCode = "";

      var dterm = $('#' + termDiv).dterm(function(command, term)
          {
            rawr.execute(ctx, command);
          },
          {
            greetings: false,
            onInit: function(terminal) {
                terminal.echo('RawrCat Interpreter' +
                              '\nCopyright (C) 2014 Ephemeral Security');
            },
            width: width,
            height: height,
            exit: false,
            autoOpen: false,
            title: "RawrTerm",
            name: 'rawrcat',
            prompt: '>> ',
            history: 1000,
          });

        // Set our initial terminal size.
        dterm.dialog('open');
        dterm.resize();

        // Hook in the rest of our UI and environment.
        var openButtonDOM = document.getElementById( "OpenConsole" );
        openButtonDOM.onclick = ( function() { dterm.dialog('open') } )

        // Override our console object, redirecting output to our
        // terminal window.
        console.log = function() {
          dterm.terminal.echo.apply(dterm, arguments);
        };

        rawr.words[ 'term_geom' ] = function(ctx) {
          ctx.stack.push( [ dterm.cols(), dterm.rows() ] )
        }

        ctx.terminal = { 'cols': dterm.cols(),
                         'rows': dterm.rows() }
        console.log( ctx.geometry );
      });
    return(ctx);
  }
  return(rawrConsole);
}

var rawrConsole = RawrConsole();
rawr.words[ 'create_terminal' ] = rawrConsole.createTerminal 
