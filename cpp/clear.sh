echo "Removing all files in ./out"
cd out
perl -e 'for(<*>){((stat)[9]<(unlink))}'
cd ..
echo "Done!"
