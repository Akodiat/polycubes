#include "io.hpp"

OutputWriter::OutputWriter(std::string filename) {
    // create an HDF5 file named 'data.h5'
    execute("CREATE FILE "+filename);

    // use (i.e. open) HDF5 file 'data.h5'
    execute("USE FILE "+filename);
}

void OutputWriter::execute(std::string command) {
    HDFql::execute(command.c_str());
}
void OutputWriter::flush() {
    execute("FLUSH");
}

void OutputWriter::setAttribute(std::string attr, int val) {
    execute("CREATE ATTRIBUTE "+attr+" AS INT VALUES("+std::to_string(val)+")");
}
void OutputWriter::setAttribute(std::string attr, std::string val) {
    execute("CREATE ATTRIBUTE "+attr+" AS VARCHAR VALUES("+val+")");
}


void OutputWriter::appendToPheno(Phenotype pheno, std::string rule) {
    // Create group hierarchy categorising phenotype size and dimensions
    std::string path = std::to_string(pheno.size) + "-mer/" +
        std::to_string(pheno.dim[2]) + "." +
        std::to_string(pheno.dim[1]) + "." +
        std::to_string(pheno.dim[0]) +
        "/pheno_" + std::to_string(pheno.id);

    if (datasets.count(path) == 0) {
        // create a dataset named 'dset' of data type VARCHAR
        // The dataset starts with 0 rows and can grow (i.e. be extended) in an unlimited fashion
        execute("CREATE DATASET "+path+" AS VARCHAR(0 TO UNLIMITED)");
        datasets.insert(path);
    }

    // alter (i.e. change) dimension of dataset 'dset' to +1 (i.e. add a new row at the end of 'dset')
    execute("ALTER DIMENSION "+path+" TO +1");

    // insert (i.e. write) data from variable 'rule' into the last row of dataset 'dset' (thanks to a point selection)
    execute("INSERT INTO "+path+"(-1) VALUES(\"" + rule + "\")");
}
