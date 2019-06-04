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

    if(argc > 1) {
        PolycubeSystem p(argv[1]);
        std::cout<<"Initialized"<<std::endl;
        p.addCube(Eigen::Vector3f(0,0,0), 0);
        std::cout<<"Added cube"<<std::endl;
        p.processMoves();
        std::cout<<"All moves processed"<<std::endl;
        std::string s = p.toString();
        std::cout<<s<<std::endl;

        std::ofstream fs;
        fs.open(std::string(argv[1])+".rule");
        fs << s;
        fs.close();
    }

    return 0;
}