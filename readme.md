# Get lecture data

## To run

```
$ yarn
$ node .
```

## Prompts
+ MOLE username
+ MOLE password
+ output relative directory filepath e.g. videos
+ modules (JSON array of strings of substring matching module name) (case insensitive)

## Output

It outputs json files and video files in a directory structure.

For module input `["text", "speech", "graphics"]` and outpath `videos` you will get:
```
videos/
  text/
    text.json
    text-0-11am26thSep2016.mp4
    ...
    text-9-03pm31stOct2017.mp4
  speech/
    speech.json
    speech-0-04pm26thSep2017.mp4
    ...
    speech-9-04pm26thOct2017.mp4
  graphics/
    graphics.json
    graphics-0-03pm25thSep2017.mp4
    ...
    graphics-9-11am23rdOct2017.mp4
```
It outputs A LOT of JSON data in the module json files.
I suggest using [jq](https://stedolan.github.io/jq/) to simplify the output

