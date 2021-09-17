#pragma once

//#include "hdf5.h"
#include <vector>
#include <string>
#include<algorithm>
#include "utils.hpp"
#include "HDFql.hpp"

class OutputWriter {
private:
    std::unordered_set<std::string> datasets;
    void execute(std::string command);

public:
    OutputWriter(std::string filename);
    void appendToPheno(Phenotype pheno, std::string rule);
    void flush();
    void setAttribute(std::string attr, int val);
    void setAttribute(std::string attr, std::string val);
};

void writePhenos(std::unordered_map<std::string, std::vector<Phenotype>> *phenomap, OutputWriter outputWriter);
