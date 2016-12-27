RawrCat
=======

A Concatenative Programming Language inspired by [Cat](http://www.cat-language.com) and [Joy](http://www.latrobe.edu.au/humanities/research/research-projects/past-projects/joy-programming-language) by [Wes Brown](https://github.com/wbrown) of [Ephemeral Security](https://github.com/ephsec/).

It is [GPLv3 licensed](http://www.gnu.org/copyleft/gpl.html); other licenses available on negotiation.

The rationale and motivations behind the RawrCat language be traced to [SVFORTH](https://github.com/ephsec/svforth) which was a [FORTH](http://en.wikipedia.org/wiki/Forth_(programming_language)) dialect that was oriented towards [security analysis and visualization](https://github.com/ephsec/svforth/blob/master/doc/svforth.md).  By shifting paradigms to a stack based approach, analysis approaches occurred that was not obvious in other programming styles.

RawrCat and SVFORTH's primary platform is JavaScript for in-browser analysis, but both also have implementations in Python to ease server-side processing via RPC calls.  RawrCat's primary advantage over SVFORTH lies in its improved concurrency and anonymous functions, known as quotations, that can be pushed onto the stack and manipulated.

RawrCat essentially turns an asynchronous callback environment in the browser into a much more manageable synchronous threaded environment.  Because of its threading/coroutines and channel implementation, RawrCat is particularly well suited to processing and manipulating streams of data in a granular fashion, giving the user instantenous feedback as it processes data.

Jumping In
----------
If you are someone who does not like reading documentation, you have three options:

  * git clone this repository (`git clone https://github.com/ephsec/RawrCat.git`) and run a browser against `index.html`
  * download the [zipfile of `master`](https://github.com/ephsec/RawrCat/archive/master.zip), unzip, and run a browser against `index.html`
  * Or, you can go to the [Github Pages](http://ephsec.github.io/RawrCat/) site

If you use Google Chrome, due to Chrome has an extremely restrictive same-origin policy that does not allow local files to use XMLHttpRequest() on a `file:///` url, you'll need to visit the Github Pages site or host it locally.  You can also use the `--allow-file-access-from-files` flag passed to Chrome, if you want it to be able to load `index.html` locally.

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
Test 'vmwarmup' passed in 2772ms (0.72150 ops/us, 721501 ops/s)
Test 'add' passed in 685ms (2.9197 ops/us, 2919708 ops/s)
Test 'div' passed in 435ms (4.5977 ops/us, 4597701 ops/s)
Test 'mul' passed in 442ms (4.5249 ops/us, 4524887 ops/s)
Test 'sub' passed in 456ms (4.3860 ops/us, 4385965 ops/s)
Test 'mod' passed in 445ms (4.4944 ops/us, 4494382 ops/s)
Test 'neg' passed in 671ms (2.9806 ops/us, 2980626 ops/s)
Test 'false' passed in 374ms (5.3476 ops/us, 5347594 ops/s)
Test 'true' passed in 366ms (5.4645 ops/us, 5464481 ops/s)
Test 'not' passed in 462ms (4.3290 ops/us, 4329004 ops/s)
Test 'and' passed in 497ms (4.0241 ops/us, 4024145 ops/s)
Test 'pop' passed in 984ms (2.0325 ops/us, 2032520 ops/s)
Test 'popd' passed in 784ms (2.5510 ops/us, 2551020 ops/s)
Test 'swap' passed in 528ms (3.7879 ops/us, 3787879 ops/s)
Test 'inc' passed in 429ms (4.6620 ops/us, 4662005 ops/s)
Test 'nil' passed in 425ms (4.7059 ops/us, 4705882 ops/s)
Test 'null' passed in 681ms (2.9369 ops/us, 2936858 ops/s)
Test 'empty' passed in 435ms (4.5977 ops/us, 4597701 ops/s)
Test 'apply' passed in 1991ms (1.0045 ops/us, 1004520 ops/s)
Test 'dip' passed in 2290ms (0.87336 ops/us, 873362 ops/s)
Test 'quote' passed in 955ms (2.0942 ops/us, 2094241 ops/s)
Test 'list' passed in 4282ms (0.46707 ops/us, 467071 ops/s)
Test 'pair' passed in 1626ms (1.2300 ops/us, 1230012 ops/s)
Test 'unit' passed in 1736ms (1.1521 ops/us, 1152074 ops/s)
Test 'head' passed in 4911ms (0.40725 ops/us, 407249 ops/s)
Test 'first' passed in 4960ms (0.40323 ops/us, 403226 ops/s)
Test 'rest' passed in 4876ms (0.41017 ops/us, 410172 ops/s)
Test 'tail' passed in 5209ms (0.38395 ops/us, 383951 ops/s)
Test 'count' passed in 5074ms (0.39417 ops/us, 394166 ops/s)
Test 'dup' passed in 1425ms (1.4035 ops/us, 1403509 ops/s)
Test 'cons' passed in 5070ms (0.39448 ops/us, 394477 ops/s)
Test 'uncons' passed in 4827ms (0.41434 ops/us, 414336 ops/s)
Test 'compose' passed in 7482ms (0.26731 ops/us, 267308 ops/s)
Test 'if' passed in 4805ms (0.41623 ops/us, 416233 ops/s)
Test 'eq' passed in 1732ms (1.1547 ops/us, 1154734 ops/s)
Test 'neq' passed in 1635ms (1.2232 ops/us, 1223242 ops/s)
Test 'gt' passed in 1905ms (1.0499 ops/us, 1049869 ops/s)
Test 'gteq' passed in 1652ms (1.2107 ops/us, 1210654 ops/s)
Test 'lt' passed in 1614ms (1.2392 ops/us, 1239157 ops/s)
Test 'while' passed in 41529ms (0.048159 ops/us, 48159 ops/s)
Test 'foreach' passed in 12038ms (0.16614 ops/us, 166141 ops/s)
Test 'fold' passed in 14773ms (0.13538 ops/us, 135382 ops/s)
Test 'repeat' passed in 14048ms (0.14237 ops/us, 142369 ops/s)
Test 'define' passed in 6424ms (0.31133 ops/us, 311333 ops/s)
Test 'hash' passed in 64160ms (0.031172 ops/us, 31172 ops/s)
Test 'hash_to_list' passed in 36564ms (0.054699 ops/us, 54699 ops/s)
Test 'hash_set' passed in 18641ms (0.10729 ops/us, 107290 ops/s)
Test 'hash_get' passed in 33211ms (0.060221 ops/us, 60221 ops/s)
Test 'hash_contains' passed in 41244ms (0.048492 ops/us, 48492 ops/s)
Test 'hash_safe_get' passed in 41453ms (0.048247 ops/us, 48247 ops/s)
Test 'from_json' passed in 2001ms (0.99950 ops/us, 999500 ops/s)
Test 'to_json' passed in 8327ms (0.24018 ops/us, 240183 ops/s)
Test 'from_string' passed in 151535ms (0.013198 ops/us, 13198 ops/s)
Test 'to_string' passed in 18574ms (0.10768 ops/us, 107677 ops/s)
Test 'compile_fib' passed in 5539ms (0.36108 ops/us, 361076 ops/s)
Test 'fib' passed in 320549ms (0.0062393 ops/us, 6239 ops/s)
Test 'clear_stack' passed in 1386ms (1.4430 ops/us, 1443001 ops/s)
Test 'thread_channel' passed in 387474ms (0.0051616 ops/us, 5162 ops/s)
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
