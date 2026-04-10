v10.26.20h4 Scroll compositing and glass layer performance pass
- reduces expensive blur/glass inside long scrolling panel bodies
- keeps lighter glass mostly on rails/floating shells
- isolates panel scroll surfaces and tones down shadow cost
