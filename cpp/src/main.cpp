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
//#include <highfive/H5File.hpp>
#include "phenotypes.pb.h"

// Declared globally to be accessable on signal exit
phenotypes::Dataset dataset;
// I know this is bad practise
std::string pid = std::to_string(getpid());
int nOub = 0;
int nNondet = 0;
int nPhenos = 0;

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

void writeToPheno(Result result, int index, std::string rule,
    phenotypes::Dataset *dataset)
{
    std::string key = result.toString()+"_"+std::to_string(index)+"_"+pid;
    auto map = dataset->mutable_phenotypes();
    if (!map->contains(key)) {
        std::vector<int> dim = result.getDimensions();
        (*map)[key].set_dim1(dim[2]);
        (*map)[key].set_dim1(dim[2]);
        (*map)[key].set_dim2(dim[1]);
        (*map)[key].set_dim3(dim[0]);
        (*map)[key].set_size(result.getSize());
        (*map)[key].set_id(index);
    }
    map->at(key).mutable_rules()->Add(rule.c_str());
}


int writeResult() {
    std::fstream output("out/phenos_"+pid+".bin",
        std::ios::out | std::ios::trunc | std::ios::binary
    );
    if (!dataset.SerializeToOstream(&output)) {
        std::cerr << "Failed to write output." << std::endl;
        return -1;
    }
    return EXIT_SUCCESS;
}

void assembleRule(std::string rule, int nTries, AssemblyMode assemblyMode,
    std::unordered_map<std::string, std::vector<Eigen::Matrix3Xf>> *phenomap,
    phenotypes::Dataset *dataset)
{
    Result result = runTries(rule, nTries, assemblyMode);
    if (!result.isBounded()) nOub++;
    else if (!result.isDeterministic()) nNondet++;
    else {
        std::string r = result.toString();
        nPhenos++;
        // If there is no phenotype with the result dimensions,
        // create a new empty list entry.
        if(!phenomap->count(r)) {
            std::vector<Eigen::Matrix3Xf> ps;
            phenomap->emplace(r, ps);
        }
        // Get phenotypes
        std::vector<Eigen::Matrix3Xf> phenos = phenomap->at(r);
        // Check to see if result matches any previous phenotype
        // with the same dimensions.
        bool matched = false;
        size_t pSize = phenos.size();
        for (size_t i=0; i<pSize; i++) {
            if (checkEquality(rule, phenos[i], assemblyMode)) {
                // If we found a match, add genotype to the corresponding file
                matched = true;
                writeToPheno(result, i, rule, dataset);
                break;
            }
        }
        if (!matched) {
            // Get phenotype coordinates (should perhaps save from earlier?)
            PolycubeSystem* p = new PolycubeSystem(rule, assemblyMode);
            p->seed();
            p->processMoves();
            // Add coordinates of this new phenotype
            phenomap->at(r).push_back(p->getCoordMatrix());
            delete p;

            // Write to file
            writeToPheno(result, phenomap->at(r).size()-1, rule, dataset);
        }
    }
}

static struct option long_options[] = {
    {"help", optional_argument, NULL, 'h'},
    {"nColors", optional_argument, NULL, 'c'},
    {"nCubeTypes", optional_argument, NULL, 't'},
    {"nDimensions", optional_argument, NULL, 'd'},
    {"nRules", optional_argument, NULL, 'n'},
    {"nTries", optional_argument, NULL, 'r'},
    {"assemblyMode", optional_argument, NULL, 'm'},
    {"writeResultEvery", optional_argument, NULL, 'w'},
    {"input", optional_argument, NULL, 'i'},
    {NULL, 0, NULL, 0}
};

int main(int argc, char **argv) {
    // Verify that the version of the library that we linked against is
    // compatible with the version of the headers we compiled against.
    GOOGLE_PROTOBUF_VERIFY_VERSION;

    // Set default argument values
    int nColors = 31;
    int nCubeTypes = 5;
    int nDimensions = 3;
    int nRules = 1;
    int nTries = 15;
    int writeResultEvery = 100000;
    AssemblyMode assemblyMode = AssemblyMode::stochastic;
    std::string input = "";
    // Loop over all of the provided arguments
    int ch;
    while ((ch = getopt_long(argc, argv, "h i:c:t:d:n:r:m:w:", long_options, NULL)) != -1) {
        switch (ch) {
        case 'h':
            std::cout <<
                "Usage: "<<argv[0]<<" [OPTIONS]"<<std::endl<<
                "Options:"<<std::endl<<
                "\t-h, --help\t\t Print this help text and exit"<<std::endl<<
                "\t-i, --input\t\t [string] Path to a file containing rules to assemble instead of generating default random input"<<std::endl<<
                "\t-c, --nColors\t\t [number] Maximum number of colors to use in random rule (default "<<nColors<<")"<<std::endl<<
                "\t-t, --nCubeTypes\t [number] Maximum size of random rule, (# of cubetypes) (default "<<nCubeTypes<<")"<<std::endl<<
                "\t-d, --nDimensions\t [number] Number of dimensions [1,2,3] of random rule (default "<<nDimensions<<")"<<std::endl<<
                "\t-n, --nRules\t\t [number] Number of random rules to generate (default "<<nRules<<")"<<std::endl<<
                "\t-r, --nTries\t\t [number] Number of tries to determine if a rule is deterministic (default "<<nTries<<")"<<std::endl<<
                "\t-w, --writeResultEvery\t [number] Frequency at which to write result to file (default "<<writeResultEvery<<")"<<std::endl<<
                "\t-m, --assemblyMode\t [random|seeded|ordered] Assemble either in strict rule order, initially seeded, or completely random (default)"<<std::endl;
            return 0;
        case 'i': input = optarg; break;
        case 'c': nColors = std::stoi(optarg); break;
        case 't': nCubeTypes = std::stoi(optarg); break;
        case 'd': nDimensions = std::stoi(optarg); break;
        case 'n': nRules = (int)std::stod(optarg); break;
        case 'r': nTries = std::stoi(optarg); break;
        case 'w': writeResultEvery = std::stoi(optarg); break;
        case 'm': assemblyMode = parseAssemblyMode(optarg); break;
        }
    }

    std::string dir = "out";
    std::system(("mkdir -p "+dir).c_str());
    if (input == "") {
        dataset.set_ncolors(nColors);
        dataset.set_ncubetypes(nCubeTypes);
        dataset.set_ndimensions(nDimensions);
        dataset.set_nrules(nRules);
    } else {
        dataset.set_inputpath(input);
    }
    dataset.set_pid(pid);
    dataset.set_ntries(nTries);
    dataset.set_assemblymode(assemblyModeToString(assemblyMode));

    if (input == "") {
        std::cout<<"Assembling "<<nRules<<" random rules, ";
    } else {
        std::cout<<"Assembling rules from "<<input<<", ";
    }
    std::cout<<"pid="<<pid<<std::endl;
    std::cout<<"Writing result every "<<writeResultEvery<<" rule"<<std::endl;

    std::unordered_map<std::string, std::vector<Eigen::Matrix3Xf>> phenomap;

    // Make sure to output result on exit
    auto onExit = [] (int i) {
        exit(writeResult());
    };

    signal(SIGINT, onExit);   // ^C
    signal(SIGABRT, onExit);  // abort()
    signal(SIGTERM, onExit);  // sent by "kill" command
    signal(SIGTSTP, onExit);  // ^Z

    std::string rule;
    if (input == "") {
        for (size_t n=0; n<nRules; n++) {
            rule = randRule(nColors, nCubeTypes, nDimensions);
            assembleRule(rule, nTries, assemblyMode, &phenomap, &dataset);
            if (n % writeResultEvery == 0) {
                std::cout<<(100*n/nRules)<<"% done ("<<n<<" rules sampled)"<<std::endl;
                writeResult();
            }
        }
    } else {
        size_t n=0;
        std::ifstream inputfile(input);
        if (inputfile.is_open()) {
            while (std::getline(inputfile, rule)) {
                assembleRule(rule, nTries, assemblyMode, &phenomap, &dataset);
                if (n % writeResultEvery == 0) {
                    std::cout<<n<<" rules sampled"<<std::endl;
                    writeResult();
                }
                n++;
            }
            inputfile.close();
        }
    }
    writeResult();
    std::cout<<"Done! Found "<<nPhenos<<" phenos. Also found "<<nOub<<" unbounded and "<<nNondet<<" nondeterministic rules"<<std::endl;

    // Optional:  Delete all global objects allocated by libprotobuf.
    google::protobuf::ShutdownProtobufLibrary();
}
