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

std::string randRule(int maxColor, int maxCubes) {
    const int colBits = 5;
    const int rotBits = 2;
    //int maxColor = pow(2, colBits); // 32;
    int nRotations = pow(2, rotBits); // 4;

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
            int sign  = signDist(r);
            int color = colorDist(r);
            int rot   = rotDist(r);
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
    {"rule", optional_argument, NULL, 'r'},
    {"maxColors", optional_argument, NULL, 'c'},
    {"maxRulesize", optional_argument, NULL, 's'},
    {"nTimes", optional_argument, NULL, 'n'},
    {"nTries", optional_argument, NULL, 't'},
    {NULL, 0, NULL, 0}
};

int main(int argc, char **argv) {
    std::string rule = "";
    int maxColors = 8;   // Max number of colors to use in random rule
    int maxRulesize = 8; // Max size of random rule
    int nTimes = 1;      // Number of random rules to generate
    int nTries = 5;      // Number of tries to determine if a rule is deterministic
    // loop over all of the options
    int ch;
    while ((ch = getopt_long(argc, argv, "r:c:s:n:t:", long_options, NULL)) != -1) {
        switch (ch) {
        case 'r': rule = std::string(optarg); break;
        case 'c': maxColors = std::stoi(optarg); break;
        case 's': maxRulesize = std::stoi(optarg); break;
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
            std::cout << result->toString() << std::endl;
        }
        delete result;
    } else {
        std::ofstream fs;
        int tmp = getpid(); char pid[100]; sprintf(pid, "%d", tmp);
        fs.open("out_"+std::string(pid));
        while (nTimes--) {
            rule = randRule(maxColors, maxRulesize);
            PolycubeResult* result = runTries(rule, nTries);
            fs << (result->toString()) << std::endl;
            delete result;
        }
        fs.close();
    }
}
