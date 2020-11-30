#include <iostream>
#include <fstream>
#include <vector>
#include "polycubeSystem.hpp"
#include "utils.hpp"
#include <bitset>
#include <getopt.h>
#include <random>
#include <chrono>
#include <bitset>
#include <math.h>
#include <unistd.h>
#include <csignal>
#include <cstdlib>

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
    if (maxColor >= 32) {
        std::cerr<<"Error: color value too large for hex rule"<<std::endl;
        exit(EXIT_FAILURE);
    }
    const int colBits = 5;
    const int rotBits = 2;
    int nRotations = pow(2, rotBits); // 4;
    int samedir[] = {1,1,2,0};

    unsigned seed = std::chrono::system_clock::now().time_since_epoch().count();
    int hex = 16;
    std::mt19937 r(seed);
    std::uniform_int_distribution<size_t> signDist(0, 1);
    std::uniform_int_distribution<size_t> colorDist(0, maxColor);
    std::uniform_int_distribution<size_t> rotDist(0, nRotations-1);
    int nCubes = maxCubes;
    char ruleBuf[nCubes*12];
    strcpy(ruleBuf, "");
    while (nCubes--) {
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

void writeToPheno(std::string result, int index, std::string rule) {
    std::string pid = std::to_string(getpid());
    std::string n = result.substr (0, result.find("_"));
    std::string dir = "out/"+n+"-mers/";
    std::ofstream fs;
    std::system(("mkdir -p "+dir).c_str());
    fs.open(dir+"pheno_"+result+"_"+std::to_string(index)+"_"+pid,std::ios_base::app);
    fs << rule << std::endl;
    fs.close();
}

static struct option long_options[] = {
    {"help", optional_argument, NULL, 'h'},
    {"nColors", optional_argument, NULL, 'c'},
    {"nCubeTypes", optional_argument, NULL, 't'},
    {"nDimensions", optional_argument, NULL, 'd'},
    {"nRules", optional_argument, NULL, 'n'},
    {"nTries", optional_argument, NULL, 'r'},
    {"seedRuleIdx", optional_argument, NULL, 'i'},
    {NULL, 0, NULL, 0}
};

// Declared globally to be accessable on signal exit
int nOub = 0;
int nNondet = 0;
int nPhenos = 0;

int main(int argc, char **argv) {
    // Set default argument values
    int nColors = 31;
    int nCubeTypes = 5;
    int nDimensions = 3;
    int nRules = 1;
    int nTries = 15;
    int seedRuleIdx = -1;
    // Loop over all of the provided arguments
    int ch;
    while ((ch = getopt_long(argc, argv, "h c:t:d:n:r:i:", long_options, NULL)) != -1) {
        switch (ch) {
        case 'h':
            std::cout <<
                "Usage: "<<argv[0]<<" [OPTIONS]"<<std::endl<<
                "Options:"<<std::endl<<
                "\t-h, --help\t\t Print this help text and exit"<<std::endl<<
                "\t-c, --nColors\t\t [number] Maximum number of colors to use in random rule (default "<<nColors<<")"<<std::endl<<
                "\t-t, --nCubeTypes\t [number] Maximum size of random rule, (# of cubetypes) (default "<<nCubeTypes<<")"<<std::endl<<
                "\t-d, --nDimensions\t [number] Number of dimensions [1,2,3] of random rule (default "<<nDimensions<<")"<<std::endl<<
                "\t-n, --nRules\t\t [number] Number of random rules to generate (default "<<nRules<<")"<<std::endl<<
                "\t-r, --nTries\t\t [number] Number of tries to determine if a rule is deterministic (default "<<nTries<<")"<<std::endl<<
                "\t-i, --seedRuleIdx\t [number] Index of cube type to initialize with, random if < 0 (default "<<seedRuleIdx<<")"<<std::endl;
            return 0;
        case 'c': nColors = std::stoi(optarg); break;
        case 't': nCubeTypes = std::stoi(optarg); break;
        case 'd': nDimensions = std::stoi(optarg); break;
        case 'n': nRules = (int)std::stod(optarg); break;
        case 'r': nTries = std::stoi(optarg); break;
        case 'i': seedRuleIdx = std::stoi(optarg); break;
        }
    }

    std::string pid = std::to_string(getpid());
    std::string dir = "out";
    std::ofstream fs;
    fs.open(dir+"/"+pid+".conf",std::ios_base::app);
    fs << "pid = "<< pid << std::endl;
    fs << "nColors = "<< nColors << std::endl;
    fs << "nCubeTypes = "<< nCubeTypes << std::endl;
    fs << "nDimensions = "<< nDimensions << std::endl;
    fs << "nRules = "<< nRules << std::endl;
    fs << "nTries = "<< nTries << std::endl;
    fs << "seedRuleIdx = "<< seedRuleIdx << std::endl;
    fs.close();

    std::cout<<"Running "<<nRules<<" rules:"<<std::endl;
    std::string rule, result;

    std::unordered_map<std::string, std::vector<Eigen::Matrix3Xf>> phenomap;

    auto onExit = [] (int i) {
          std::cout<<"Found "<<nPhenos<<" phenos. Also found "<<nOub<<" unbounded and "<<nNondet<<" nondeterministic rules"<<std::endl;
          exit(EXIT_SUCCESS);
    };

    signal(SIGINT, onExit);   // ^C
    signal(SIGABRT, onExit);  // abort()
    signal(SIGTERM, onExit);  // sent by "kill" command
    signal(SIGTSTP, onExit);  // ^Z

    while (nRules--) {
        rule = randRule(nColors, nCubeTypes, nDimensions);
        result = runTries(rule, nTries, seedRuleIdx);
        if (result == "oub") nOub++;
        else if (result == "nondet") nNondet++;
        else {
            // If there is no phenotype with the result dimensions,
            // create a new empty list entry.
            if(!phenomap.count(result)) {
                std::vector<Eigen::Matrix3Xf> ps;
                phenomap.emplace(result, ps);
            }
            // Get phenotypes
            std::vector<Eigen::Matrix3Xf> phenos = phenomap.at(result);
            // Check to see if result matches any previous phenotype
            // with the same dimensions.
            bool matched = false;
            size_t pSize = phenos.size();
            for (size_t i=0; i<pSize; i++) {
                if (checkEquality(rule, phenos[i], seedRuleIdx)) {
                    // If we found a match, add genotype to the corresponding file
                    matched = true;
                    writeToPheno(result,i,rule);
                    break;
                }
            }
            if (!matched) {
                // Get phenotype coordinates (should perhaps save from earlier?)
                PolycubeSystem* p = new PolycubeSystem(rule);
                p->seed(seedRuleIdx);
                p->processMoves();
                // Add coordinates of this new phenotype
                phenomap.at(result).push_back(p->getCoordMatrix());
                delete p;
                nPhenos++;

                // Write to file
                writeToPheno(result,0,rule);
            }
        }
    }
    onExit(0);
}
