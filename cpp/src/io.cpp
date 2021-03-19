#include "io.hpp"

class WriteString
// Adapted from https://stackoverflow.com/a/15220532
{
public:
    WriteString(hid_t dataset, hid_t datatype, hid_t dataspace, hid_t memspace)
        : m_dataset(dataset), m_datatype(datatype), m_dataspace(dataspace), m_memspace(memspace), m_pos() {}

private:
    hid_t m_dataset;
    hid_t m_datatype;
    hid_t m_dataspace;
    hid_t m_memspace;
    hsize_t m_pos;

public:
    void operator()(std::vector<std::string>::value_type const &v)
    {
        // Select the file position, 1 record at position 'pos'
        hsize_t count[] = {1};
        hsize_t offset[] = {m_pos++};
        H5Sselect_hyperslab(m_dataspace, H5S_SELECT_SET, offset, NULL, count, NULL);

        const char *s = v.c_str();
        H5Dwrite(m_dataset, m_datatype, m_memspace, m_dataspace, H5P_DEFAULT, &s);
    }
};

void writePheno(hid_t group, std::vector<std::string> const &v, std::string name)
{
    hsize_t dims[] = {v.size()};
    hid_t dataspace = H5Screate_simple(
        sizeof(dims) / sizeof(*dims), dims, NULL
    );

    dims[0] = 1;
    hid_t memspace = H5Screate_simple(
        sizeof(dims) / sizeof(*dims), dims, NULL
    );

    hid_t datatype = H5Tcopy(H5T_C_S1);
    H5Tset_size(datatype, H5T_VARIABLE);

    hid_t dataset = H5Dcreate1(group, name.c_str(), datatype, dataspace, H5P_DEFAULT);

    // Select the "memory" to be written out - just 1 record.
    hsize_t offset[] = {0};
    hsize_t count[] = {1};
    H5Sselect_hyperslab(memspace, H5S_SELECT_SET, offset, NULL, count, NULL);

    std::for_each(v.begin(), v.end(), WriteString(dataset, datatype, dataspace, memspace));

    H5Dclose(dataset);
    H5Sclose(dataspace);
    H5Sclose(memspace);
    H5Tclose(datatype);
}

int writeResult(std::unordered_map<std::string, std::vector<Phenotype>> phenomap, std::string filename) {
    hid_t file, group, gcpl, space, dset;          /* Handles */
    herr_t status;

    // Backup old file if existing
    std::system(("mv -f "+filename+" "+filename+".bak 2>/dev/null").c_str());

    // Create a new file using the default properties.
    file = H5Fcreate(filename.c_str(), H5F_ACC_TRUNC, H5P_DEFAULT, H5P_DEFAULT);

    // Create group creation property list and set it to allow creation of intermediate groups.
    gcpl = H5Pcreate(H5P_LINK_CREATE);
    status = H5Pset_create_intermediate_group(gcpl, 1);

    for (auto &x: phenomap) {
        Phenotype first = x.second[0];
        std::string path = std::to_string(first.size) + "-mer/" +
                std::to_string(first.dim[2]) + "_" +
                std::to_string(first.dim[1]) + "_" +
                std::to_string(first.dim[0]);
        group = H5Gcreate (file, path.c_str(), gcpl, H5P_DEFAULT, H5P_DEFAULT);
        for (Phenotype &p : x.second) {
            writePheno(group, p.rules, "pheno"+std::to_string(p.id));
        }
    }

    // Close and release resources.
    status = H5Fclose(file);

    return EXIT_SUCCESS;
}
