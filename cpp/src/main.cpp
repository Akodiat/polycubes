#include <iostream>
#include <fstream>
#include <vector>
#include "polycubeSystem.hpp"
#include <bitset>
#include <getopt.h>
#include <random>
#include <chrono>
#include <bitset>
#include <math.h>
#include <unistd.h>

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

std::string randRule(int maxColor, int maxCubes, int dim) {
    const int colBits = 5;
    const int rotBits = 2;
    int nRotations = pow(2, rotBits); // 4;
    int samedir[] = {1,1,2,0};

    unsigned seed = std::chrono::system_clock::now().time_since_epoch().count();
    int hex = 16;
    std::mt19937 r(seed);
    std::uniform_int_distribution<size_t> signDist(0, 1);
    std::uniform_int_distribution<size_t> colorDist(0, maxColor-1);
    std::uniform_int_distribution<size_t> rotDist(0, nRotations-1);
    std::uniform_int_distribution<size_t> nRuleDist(1, maxCubes);
    int nCubes = nRuleDist(r);
    char ruleBuf[nCubes*12];
    strcpy(ruleBuf, "");
    while (nCubes --) {
        for(int i=0; i<6; i++) {
            int sign, color, rot;

            // If we want less than 3 dimensions,
            // Don't give any values to the other faces
            if(i >= dim*2) {
                sign = 0; color = 0; rot = 0;
            } else {
                sign  = signDist(r);
                color = colorDist(r);
                // 3D rules should have random rotation of
                // faces, others should all face the same way.
                rot = dim < 3 ? samedir[i] : rotDist(r);
            }

            std::string signStr = std::bitset<1>(sign).to_string();
            std::string colorStr = std::bitset<colBits>(color).to_string();
            std::string rotStr = std::bitset<rotBits>(rot).to_string();

            std::string totStr = signStr + colorStr + rotStr;
            int rule = std::stoi(totStr, 0, 2);
            sprintf(ruleBuf+strlen(ruleBuf),"%02x", rule);
        }
    }
    return std::string(ruleBuf);
}
PolycubeResult* runTries(std::string rule, int nTries)
{
    int nCubes = 0;
    std::string s = "";
    while (nTries--) {
        PolycubeSystem p = PolycubeSystem(rule);
        p.addCube(Eigen::Vector3f(0, 0, 0), 0);
        nCubes = p.processMoves();

        if (nCubes <= 0) {
            return new PolycubeResult(std::string(rule), "oub" + std::to_string(p.getNMaxCubes()));
        }
        std::string s_new = p.toString();
        if (s == "") {
            s = s_new;
        }
        else if (s != s_new) {
            return new PolycubeResult(std::string(rule), "nondet");
        }
    }
    // If we had the same result every try:
    return new InterestingPolycubeResult(std::string(rule), nCubes, s);
}

static struct option long_options[] = {
    {"help", optional_argument, NULL, 'h'},
    {"rule", optional_argument, NULL, 'r'},
    {"maxColors", optional_argument, NULL, 'c'},
    {"maxRulesize", optional_argument, NULL, 's'},
    {"dimensions", optional_argument, NULL, 'd'},
    {"nTimes", optional_argument, NULL, 'n'},
    {"nTries", optional_argument, NULL, 't'},
    {NULL, 0, NULL, 0}
};

int main(int argc, char **argv) {
    // Set default argument values
    std::string rule = "";
    int maxColors = 8;
    int maxRulesize = 8;
    int dimensions = 3;
    int nTimes = 1;
    int nTries = 5;
    // Loop over all of the provided arguments
    int ch;
    while ((ch = getopt_long(argc, argv, "h r:c:s:d:n:t:", long_options, NULL)) != -1) {
        switch (ch) {
        case 'h':
            std::cout <<
                "Usage: "<<argv[0]<<" [OPTIONS]"<<std::endl<<
                "Options:"<<std::endl<<
                "\t-h, --help\t\t Print this help text and exit"<<std::endl<<
                "\t-r, --rule\t\t Specify a specific rule (don't generate randomly)"<<std::endl<<
                "\t-c, --maxColors\t\t Maximum number of colors to use in random rule (default "<<maxColors<<")"<<std::endl<<
                "\t-s, --maxRulesize\t Maximum size of random rule (default "<<maxRulesize<<")"<<std::endl<<
                "\t-d, --dimensions\t Number of dimensions [1,2,3] of random rule (default "<<dimensions<<")"<<std::endl<<
                "\t-n, --nTimes\t\t Number of random rules to generate (default "<<nTimes<<")"<<std::endl<<
                "\t-t, --nTries\t\t Number of tries to determine if a rule is deterministic (default "<<nTries<<")"<<std::endl;
            return 0;
        case 'r': rule = std::string(optarg); break;
        case 'c': maxColors = std::stoi(optarg); break;
        case 's': maxRulesize = std::stoi(optarg); break;
        case 'd': dimensions = std::stoi(optarg); break;
        case 'n': nTimes = (int)std::stod(optarg); break;
        case 't': nTries = std::stoi(optarg); break;
        }
    }

    if (rule.length() > 0) {
        // Run with the rule provided, ignoring other parameters
        PolycubeResult* result = runTries(rule, nTries);
        if(result->isInteresting()) {
            InterestingPolycubeResult* interestingRes = 
                dynamic_cast<InterestingPolycubeResult*>(result);
            std::cout << interestingRes->getCoords();
            delete interestingRes;
        } else {
            std::cout << result->getSuffix() << std::endl;
        }
        delete result;
    } else {
        std::ofstream fs;
        int tmp = getpid(); char pid[100]; sprintf(pid, "%d", tmp);
        fs.open("out_"+std::string(pid));
        while (nTimes--) {
            rule = randRule(maxColors, maxRulesize, dimensions);
            PolycubeResult* result = runTries(rule, nTries);
            fs << (result->toString()) << std::endl;
            delete result;
        }
        fs.close();
    }
}
