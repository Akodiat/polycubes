#pragma once

#include "hdf5.h"
#include <vector>
#include <string>
#include<algorithm>
#include "utils.hpp"

void writePheno(hid_t group, std::vector<std::string> const &v, std::string name);

int writeResult(std::unordered_map<std::string, std::vector<Phenotype>> phenomap, std::string filename);