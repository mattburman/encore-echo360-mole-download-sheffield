# Get lecture data

## To run

```
$ yarn
$ node .
```

## Prompts
+ MOLE username
+ MOLE password
+ output filepath
+ modules (JSON array of strings of substring matching module name) (case insensitive)

## Output

It outputs A LOT of data.
I suggest using [jq](https://stedolan.github.io/jq/) to simplify the output:

`$ cat outfile.json|jq 'map({moduleName, url, lec: .lectures[]|{min,max,date,time}})'`
