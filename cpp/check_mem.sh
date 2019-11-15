g++ -g src/main.cpp src/polycubeSystem.cpp -o bin/polycubes
valgrind --tool=memcheck --leak-check=yes bin/polycubes
