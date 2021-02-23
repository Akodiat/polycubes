#ifndef UTILS_H
#define UTILS_H

#include <string>
#include <vector>
#include <string>
#include <set>
#include "polycubeSystem.hpp"
#include "../lib/Eigen/Dense"
#include "../lib/Eigen/Geometry"

struct Phenotype {
  Eigen::Matrix3Xf coords;
  std::vector<std::string> rules;
  std::vector<int> dim;
  size_t size;
  size_t id;
};

class Result {
private:
    std::vector<int> dim;
    size_t size;
    bool bounded;
    bool deterministic;

public:
    Result(size_t size, std::vector<int> dim) {
        this->size = size;
        this->dim = dim;
        this->bounded = this->deterministic = true;
    }

    Result(bool bounded, bool deterministic) {
        this->bounded = bounded;
        this->deterministic = deterministic;
    }

    std::string toString() {
        return std::to_string(size)+"_" +
            std::to_string(dim[2])+","+
            std::to_string(dim[1])+","+
            std::to_string(dim[0]);
    }
    bool isBounded() {return bounded;}
    bool isDeterministic() {return deterministic;}
    size_t getSize() {return size;}
    std::vector<int> getDimensions() {return dim;}
};

std::string assemblyModeToString(AssemblyMode m);
AssemblyMode parseAssemblyMode(std::string s);

Result runTries(std::string rule, int nTries, AssemblyMode assemblyMode);

bool checkEquality(std::string rule1, std::string rule2, AssemblyMode assemblyMode);
bool checkEquality(std::string rule, Eigen::Matrix3Xf coords, AssemblyMode assemblyMode);

// Split string, from https://stackoverflow.com/a/10058725
std::vector<std::string> splitString(std::string s, char delim);

// Make any -0 into 0
float noNeg0(float f);

// Turn a vector into a string
std::string vecToStr(Eigen::Vector3f v);

// Enumerate all rotation matrices for polycube equality
std::vector<Eigen::Matrix3f> calcAllRotations();

// Compare matrices, ignoring column order
bool compCols(Eigen::Matrix3Xf m1, Eigen::Matrix3Xf m2);

#endif // UTILS_H