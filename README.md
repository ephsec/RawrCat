RawrCat
=======

A Concatenative Programming Language inspired by [Cat](http://www.cat-language.com) and [Joy](http://www.latrobe.edu.au/humanities/research/research-projects/past-projects/joy-programming-language) by [Wes Brown](https://github.com/wbrown) of [Ephemeral Security](https://github.com/ephsec/).

It is [GPLv3 licensed](http://www.gnu.org/copyleft/gpl.html); other licenses available on negotiation.

The rationale and motivations behind the RawrCat language be traced to [SVFORTH](https://github.com/ephsec/svforth) which was a [FORTH](http://en.wikipedia.org/wiki/Forth_(programming_language)) dialect that was oriented towards [security analysis and visualization](https://github.com/ephsec/svforth/blob/master/doc/svforth.md).  By shifting paradigms to a stack based approach, analysis approaches occurred that was not obvious in other programming styles.

RawrCat and SVFORTH's primary platform is JavaScript for in-browser analysis, but both also have implementations in Python to ease server-side processing via RPC calls.  RawrCat's primary advantage over SVFORTH lies in its improved concurrency and anonymous functions, known as quotations, that can be pushed onto the stack and manipulated.

RawrCat essentially turns an asynchronous callback environment in the browser into a much more manageable synchronous threaded environment.  Because of its threading/coroutines and channel implementation, RawrCat is particularly well suited to processing and manipulating streams of data in a granular fashion, giving the user instantenous feedback as it processes data.

Jumping In
----------
If you are someone who does not like reading documentation, simply git clone this repository and run a browser on `index.html` to see the demo code running in a JQuery terminal window.  If you use Chrome, you will need to disable Chrome's same-origin policy for local files, using the `--allow-file-access-from-files` flag, or serve the files up using a local web server.

A particularly good example of the concurrency in RawrCat is the `threading` demo.  It shows two threads running in a single threaded JavaScript VM, one computing the fibonacci sequence, and the other splashing random rectangles on a canvas behind the JQuery terminal window.  You will also notice that while these two threads are running, the `REPL` is still interactive and more functions and processes can be run.

The `index.html` file has RawrCat code inline, making it simple to modify and play with the environment.  Simply reload once you have made changes.  All the demo code can be found there.  Documentation of functions need to be written, but example usage can be found in the testcases in `js/rawrcat.js`.

Here, we lift the `randrect` example from `index.html` to show what a RawrCat program looks like:

```Forth
  ( *** randrect ****************************************************** )
  define pick_color    [ 0 255 rand 0 255 rand 0 255 rand set_color ]
  define draw_rand_box [ pick_color
                         0 800 rand 0 600 rand
                         0 800 rand 0 600 rand
                         fill_rect ]
  define randrect      [ "canvas" get_canvas
                         [ pick_color draw_rand_box ] [ true ] while ]
```

The above can be written as a single function, but best programming practices in a concatenative language tells us to decompose the functions as much as possible.

   * In `randrect`, `get_canvas` acquires the DOM object with the HTML5 ID of `canvas`, and pushes it onto the stack.
   * `pick_color` picks three random 8-bit integers, pushing them onto the stack.  The stack diagram at this point might look like:

```
    3: 192
    2: 128
    1: 64
    0: [object CanvasRenderingContext2D]
```


   * When `set_color` is called, all four values are popped off the stack, and the color of the pen in the HTML5 canvas is set; the canvas object is then pushed back onto the stack for later reuse.
   * `draw_rand_box` is then called, which does a similar thing as above, except using two random coordinate locations to draw a rectangle.
   * Note that both `[ pick_color draw_rand_box ]` and `[ true ]` are quotations that are pushed onto the stack before being evaluated by `while`.  The second argument to `while` is expected to result in a boolean value, and can be more complex than simply producing `true`.  In most cases, we'd want to use `forever` rather than `[ true ] while`, but this is an illustrative example of conditionals.

Concatenative Programming and Composibility
-------------------------------------------

Like Cat and Joy, functions can be composed and decomposed in a concatenative fashion.  For example:

```
>> [1 2]
>> [3 +]
>> print_stack
        1: [3 +]
        0: [1 2]
```

In the above snippet, we pushed two quotations onto the stack; the first quotation, `[1 2]`, pushes `1` and `2` onto the stack, while the second quotation, `[3 +]` pushes `3` onto the stack and performs `+` on the top two elements on the stack.

```
>> compose
>> print_stack
        0: [[1 2] [3 +]]
```

Here, we composed both quotations into a single function on the stack.  In a concatenative programming language, functions or quotations can be composed and decomposed, leveraging the immutability of functional programming.

```
>> trace apply
2:| []                                          apply --> [[[1 2] [3 +]]]
2: | [+ 3]                                            --> []
2:  | [2 1]                                           --> []
3:  | [2]                                           1 --> []
4:  | []                                            2 --> [1]
4: | [+ 3]                                            --> [2 1]
5: | [+]                                            3 --> [2 1]
6: | []                                             + --> [3 2 1]
6:| []                                                --> [5 1]
>> print_stack
        1: 5
        0: 1
```

Above, we `apply` the quotation, evaluating it.  The example also shows one of RawrCat's nicer features, a `trace` function that shows the stream of tokens to be executed on the left, and the resulting stack on the right.  When a quotation is entered, an entirely new stack is created for it, allowing for functional closures.

Having quotations that are effectively closures elevates RawrCat to a much more usable level than SVFORTH.

Threading and Concurrency
-------------------------

RawrCat heavily abuses JavaScript internals to get effective threading and concurrency.  RawrCat's concurrency can best be described as psuedo-cooperative.  A looping function that does not invoke `yield` will eventually be forced to yield due to RawrCat's internal `nextTick` method -- but for best user responsiveness and granular concurrency, `yield` should be used.  Note that the `nextTick` threshold can be adjusted to allow for granular performance without `yield`, but it will come at a great cost for long running data processing performance.

Threads would not do much good without the ability to pass results back and forth, and RawrCat's primary mechanism to do so are `channels` which are inspired by `Go` and can be likened to Windows mutexes or Unix named pipes.  Channels are straightforward:

* `->` reads an item from a channel and pushes it onto the stack
* `<-` pops an item from the stack and writes it to the channel
* `?>` returns a boolean as to if there is a writer waiting for a reader on a channel, which is significant because channel reads and writes are always blocking and uninterruptible.

Due to the blocking nature of channels, in that control is passed from the writer to the reader, or vice versa, it is an effective way to get yet more concurrency.

A trivial example of channels can be found in `index.html` and is included here:

```
  ( *** channels demo ************************************************* )
  #ping create_channel
  #pong create_channel
  define channels      [ [ [ #ping -> ( block until read from #ping )
                             dup "ping " + write
                             2 *      ( do some math on fetched value )
                             #pong <- ( write mathed up value to #pong ) ]
                             forever ] "pong-thread" nil thread

                         2 [ #ping <-  ( write current value to ping )
                             #pong ->  ( get new current value from pong )
                             dup "pong " + write ( report the new value ) ]
                             [ dup 1024 lt ] while
                             stop-threads ]
```

In the above example, we have two channels, `#ping` and `#pong`.  `#ping` is serviced by a `thread`, and the thread's execution is blocked until something is written to the channel.  When an item shows up on the `#ping` channel, it is reported to the user, some math is performed, and it in turn writes the resulting number onto `#pong`.

The second process is not a thread and is run in the foreground interpreter loop.  The stack is seeded with `2`, and the quotation writes it to `#ping`, reads the resulting value from `#pong` onto the stack, reports the new value to the user.  This is looped until the result is no longer less than `1024`.

With the above example, control is passed back and forth with the messages, and we have sub-thread granularity of execution.

Rawrcat Speed
-------------

Rawrcat is designed to be as quick as possible, and many optimization and performance tricks were done in the JavaScript language.  To ensure that the implementations of the language behaved exactly the same, extensive test cases were written, that double as benchmarks.

On a late 2013 Retina MacBook Pro with a 2.6ghz Core i7, the following benchmark results were obtained in `node.js` -- note that the benchmarks also include the time to execute the benchmark loop quotation, like so: `[ clear_stack [ 2 1 + ] list ] 500000 repeat`, so actual per-instruction performance is probably much faster.  As can be seen from the results, performance is measured in the sub-microsecond territory.

Particularly complex examples are:

   * `fib` - `6,118` function calls per second with `702` instructions executed per call.

```
define fib [ dup 1 <= [] [ dup 1 - fib swap 2 - fib + ] if ]
8 fib
```

   * `thread_channel` - `12,112` function calls per second -- this translates to `~12,000` messages passed per second via channels.

```
#test create_channel
[ [ #test -> #test <- ] forever ] "thread_channel" nil thread
1 [2 mul #test <- #test ->] [ dup 100 lteq ] while
stop-threads
```

The complete benchmarks are below.

```
Test 'vmwarmup' passed in 1467ms (0.34083 ops/us, 340832 ops/s)
Test 'add' passed in 856ms (0.58411 ops/us, 584112 ops/s)
Test 'div' passed in 860ms (0.58140 ops/us, 581395 ops/s)
Test 'mul' passed in 858ms (0.58275 ops/us, 582751 ops/s)
Test 'sub' passed in 856ms (0.58411 ops/us, 584112 ops/s)
Test 'mod' passed in 864ms (0.57870 ops/us, 578704 ops/s)
Test 'neg' passed in 813ms (0.61501 ops/us, 615006 ops/s)
Test 'false' passed in 762ms (0.65617 ops/us, 656168 ops/s)
Test 'true' passed in 774ms (0.64599 ops/us, 645995 ops/s)
Test 'not' passed in 859ms (0.58207 ops/us, 582072 ops/s)
Test 'and' passed in 866ms (0.57737 ops/us, 577367 ops/s)
Test 'pop' passed in 918ms (0.54466 ops/us, 544662 ops/s)
Test 'popd' passed in 942ms (0.53079 ops/us, 530786 ops/s)
Test 'swap' passed in 905ms (0.55249 ops/us, 552486 ops/s)
Test 'inc' passed in 828ms (0.60386 ops/us, 603865 ops/s)
Test 'nil' passed in 799ms (0.62578 ops/us, 625782 ops/s)
Test 'null' passed in 804ms (0.62189 ops/us, 621891 ops/s)
Test 'empty' passed in 844ms (0.59242 ops/us, 592417 ops/s)
Test 'apply' passed in 1254ms (0.39872 ops/us, 398724 ops/s)
Test 'dip' passed in 1316ms (0.37994 ops/us, 379939 ops/s)
Test 'quote' passed in 1142ms (0.43783 ops/us, 437828 ops/s)
Test 'list' passed in 1329ms (0.37622 ops/us, 376223 ops/s)
Test 'pair' passed in 879ms (0.56883 ops/us, 568828 ops/s)
Test 'unit' passed in 914ms (0.54705 ops/us, 547046 ops/s)
Test 'head' passed in 1400ms (0.35714 ops/us, 357143 ops/s)
Test 'first' passed in 1507ms (0.33179 ops/us, 331785 ops/s)
Test 'rest' passed in 1375ms (0.36364 ops/us, 363636 ops/s)
Test 'tail' passed in 1474ms (0.33921 ops/us, 339213 ops/s)
Test 'count' passed in 1414ms (0.35361 ops/us, 353607 ops/s)
Test 'dup' passed in 999ms (0.50050 ops/us, 500501 ops/s)
Test 'cons' passed in 1436ms (0.34819 ops/us, 348189 ops/s)
Test 'uncons' passed in 1396ms (0.35817 ops/us, 358166 ops/s)
Test 'compose' passed in 1720ms (0.29070 ops/us, 290698 ops/s)
Test 'if' passed in 1314ms (0.38052 ops/us, 380518 ops/s)
Test 'eq' passed in 898ms (0.55679 ops/us, 556793 ops/s)
Test 'neq' passed in 892ms (0.56054 ops/us, 560538 ops/s)
Test 'gt' passed in 894ms (0.55928 ops/us, 559284 ops/s)
Test 'gteq' passed in 882ms (0.56689 ops/us, 566893 ops/s)
Test 'lt' passed in 893ms (0.55991 ops/us, 559910 ops/s)
Test 'while' passed in 7610ms (0.065703 ops/us, 65703 ops/s)
Test 'foreach' passed in 2569ms (0.19463 ops/us, 194628 ops/s)
Test 'fold' passed in 2933ms (0.17047 ops/us, 170474 ops/s)
Test 'define' passed in 1508ms (0.33156 ops/us, 331565 ops/s)
Test 'hash' passed in 3854ms (0.12974 ops/us, 129735 ops/s)
Test 'hash_to_list' passed in 3182ms (0.15713 ops/us, 157134 ops/s)
Test 'hash_set' passed in 2702ms (0.18505 ops/us, 185048 ops/s)
Test 'hash_get' passed in 3174ms (0.15753 ops/us, 157530 ops/s)
Test 'hash_contains' passed in 3327ms (0.15029 ops/us, 150286 ops/s)
Test 'hash_safe_get' passed in 3457ms (0.14463 ops/us, 144634 ops/s)
Test 'from_json' passed in 976ms (0.51230 ops/us, 512295 ops/s)
Test 'to_json' passed in 1600ms (0.31250 ops/us, 312500 ops/s)
Test 'from_string' passed in 8000ms (0.062500 ops/us, 62500 ops/s)
Test 'to_string' passed in 3568ms (0.14013 ops/us, 140135 ops/s)
Test 'compile_fib' passed in 1240ms (0.40323 ops/us, 403226 ops/s)
Test 'fib' passed in 81727ms (0.0061179 ops/us, 6118 ops/s)
Test 'clear_stack' passed in 984ms (0.50813 ops/us, 508130 ops/s)
Test 'thread_channel' passed in 41281ms (0.012112 ops/us, 12112 ops/s)
```

ToDo
----

There remains much more to be done with RawrCat, but it has reached a good enough level of functionality that security analysis is performed in it.

   * *Function documentation* - functions and primitives should be better documented than just a test case
   * *Static typing of input to functions* - this comes from Cat, and would lead to much more robustness
   * *Compiler and tokenizer documentation* - this module is undocumented, but has clearly written code.
   * *JavaScript-target compiler* - with static typing, we can write a JavaScript code generator for even more performance rather than effectively implement a VM in JavaScript.
   * *Cleanup and release of Python implementation* - a more or less complete Python implementation of RawrCat exists, however threading and channels need to be implemented, along with reorganization, commentingand cleanup.
   * *Implement RawrCat in RawrCat* - self-hosting!
   * *Implement RawrCat in LLVM IR* - for maximum performance and architecture/VM independence
