#!/bin/sh

PDF_FILE=$1 # $1 is the file-name.pdf
FILE_NAME=basename .pdf

gs -sDEVICE=pngalpha -o $FILE_NAME-%03d.png -r144 $PDF_FILE