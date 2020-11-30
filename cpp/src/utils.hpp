#ifndef UTILS_H
#define UTILS_H

#include <string>
#include <vector>
#include <string>
#include <set>
#include "../lib/Eigen/Dense"
#include "../lib/Eigen/Geometry"

std::string runTries(std::string rule, int nTries, int seedRuleIdx);

bool checkEquality(std::string rule1, std::string rule2, int seedRuleIdx);
bool checkEquality(std::string rule, Eigen::Matrix3Xf coords, int seedRuleIdx);

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