//#include <python3.6/Python.h>
#include <pybind11/pybind11.h>
#include "polycubeSystem.hpp"
#include "utils.hpp"

namespace py = pybind11;

using namespace pybind11::literals;

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


// Compare if the two rules form the same polycube
bool checkEquality(std::string rule1, std::string rule2) {
    PolycubeResult *r1, *r2;
    r1 = runTries(rule1, 1);
    r2 = runTries(rule2, 1);
    if(r1->isInteresting() && r2->isInteresting()) {
        InterestingPolycubeResult *ir1, *ir2;
        ir1 = dynamic_cast<InterestingPolycubeResult*>(r1);
        ir2 = dynamic_cast<InterestingPolycubeResult*>(r2);
        bool equal = ir1->equals(ir2);
        delete ir1;
        delete ir2;
        return equal;
    }
    delete r1;
    delete r2;
    return false;
}

PYBIND11_MODULE(polycubes, m) {
    m.doc() = "Polycube python binding";
    m.def("checkEquality", &checkEquality, "Compare if the two rules form the same polycube");
}