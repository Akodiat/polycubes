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

    if (argc > 1) {
        PolycubeSystem p = 
            argc > 2 ?
            PolycubeSystem(argv[1], std::stoi(argv[2])) : 
            PolycubeSystem(argv[1]);
        std::cout<<"Initialized"<<std::endl;
        p.addCube(Eigen::Vector3f(0,0,0), 0);
        std::cout<<"Added cube"<<std::endl;
        int nCubes = p.processMoves();
        std::ofstream fs;
        if (nCubes > 0) {
            std::cout<<"All moves processed, "<<nCubes<<" cubes in total"<<std::endl;
            std::string s = p.toString();
            std::cout<<s<<std::endl;
            fs.open(std::string(argv[1])+"."+std::to_string(nCubes)+"-mer");
            fs << s;
        } else {
            fs.open(
                std::string(argv[1]) +
                ".oub" +
                std::to_string(p.getNMaxCubes())
            );
        }
        fs.close();
    }
    else {
        std::cout<<"Sorry, you need to supply a rule"<<std::endl;
    }

    return 0;
}