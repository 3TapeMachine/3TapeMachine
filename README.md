# [3 Tape Turing Machine]

This is a [Turing machine] visualizer designed for learning through visual thinking and creative exploration.

Machines are described in a simple YAML-based format.
As you code, each save updates the state diagram; this offers the speed and directness of code, combined with the visual intuitiveness of a graphical editor.

Multiple example machines are provided, each one with commentary that touches on concepts like subroutines and inductive definitions / recursion.
Many examples include exercises that build on the machines and deepen understanding.
To encourage experimentation, the document system provides for quick snapshots and autosaving to browser local storage.

All in all, this is the simulator I wish I had when taking automata theory.
At the same time, I’ve tried to make it accessible to people who aren’t in computer science, or haven’t heard of a Turing machine before.


[Turing machine]: http://plato.stanford.edu/entries/turing-machine


## Development Setup

If you want to work on the site itself, here’s how to get started:

Clone the repo and run `npm install` in the folder. Afterwards, use `npm start` to host the site locally on a [webpack server], by default at localhost:8080.


[webpack server]: https://webpack.github.io/docs/webpack-dev-server.html


## Dependencies

Thanks go to the authors of the following runtime dependencies:

* [Ace] code editor
* [bluebird.js] cancellable promises
* [Bootstrap] with the [lumen] theme
* [clipboard.js] one-click copy to clipboard
* [D3] visualization and DOM manipulation library
* [jQuery]
* [js-yaml] parser & serializer
* [lodash] and [lodash/fp] utilities

[Ace]: https://ace.c9.io/
[bluebird.js]: http://bluebirdjs.com/
[Bootstrap]: https://getbootstrap.com/
[clipboard.js]: https://clipboardjs.com/
[D3]: https://d3js.org/
[jQuery]: https://jquery.com
[js-yaml]: https://github.com/nodeca/js-yaml
[lodash]: https://github.com/lodash/lodash
[lodash/fp]: https://github.com/lodash/lodash/wiki/FP-Guide
[lumen]: https://bootswatch.com/lumen/

## Original Source

Special Thanks to Andy Li who created the original [visualizer] this project was based on.

[visualizer]: https://turingmachine.io
