#include <iostream>
#include <fstream>
#include <vector>
#include "polycubeSystem.hpp"
#include <cmath>
#include <bitset>

// 0 sign
// 0 value 16
// 0 value 8
// 0 value 4

// 0 value 2
// 0 value 1
// 0 face orientation
// 0 face orientation

// 32 possible values (colours)
// Need 2 hexadecimal digits.


int main(int argc, char** argv) {
    std::cout<<"Welcome to polycubes!"<<std::endl;

    static int nTries = 5;
    if (argc > 1) {
        int nCubes = 0;
        std::ofstream fs;
        std::string s = "";
        while(nTries--) {
            PolycubeSystem p =
                argc > 2 ?
                PolycubeSystem(argv[1], std::stoi(argv[2])) :
                PolycubeSystem(argv[1]);
            p.addCube(Eigen::Vector3f(0,0,0), 0);
            nCubes = p.processMoves();
            if (nCubes <= 0) {
                fs.open(
                    std::string(argv[1]) +
                    ".oub" +
                    std::to_string(p.getNMaxCubes())
                );
                fs.close();
                return -1;
            }
            std::string s_new = p.toString();
            if (s == "") {
                s = s_new;
            }
            else if (s != s_new) {
                fs.open(
                    std::string(argv[1]) +
                    ".nondet"
                );
                fs.close();
                return -1;
            }
        }
        // If we had the same result every try:
        fs.open(std::string(argv[1])+"."+std::to_string(nCubes)+"-mer");
        fs << s;
        fs.close();
        return nCubes;
    }
    else {
        std::cout<<"Sorry, you need to supply a rule"<<std::endl;
    }

    return -2;
}