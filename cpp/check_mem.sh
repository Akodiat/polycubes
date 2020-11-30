g++ -g src/main.cpp src/polycubeSystem.cpp src/utils.cpp -o bin/polycubes
valgrind --tool=memcheck --leak-check=yes bin/polycubes -n 100
