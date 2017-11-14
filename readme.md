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
    text-0-20160926-1100.mp4
    ...
    text-9-20171031-1500.mp4
  speech/
    speech.json
    speech-0-20170926-1600.mp4
    ...
    speech-9-20171026-1600.mp4
  graphics/
    graphics.json
    graphics-0-20170925-1500.mp4
    ...
    graphics-9-20171023-1100.mp4
```
It outputs A LOT of JSON data in the module json files.
I suggest using [jq](https://stedolan.github.io/jq/) to simplify the output

