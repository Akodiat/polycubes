//#include <python3.6/Python.h>
#include <pybind11/pybind11.h>
#include "polycubeSystem.hpp"
#include "utils.hpp"

namespace py = pybind11;

using namespace pybind11::literals;

bool isBoundedAndDeterministic(std::string rule, int nTries, int seedRuleIdx) {
    std::string result = runTries(rule, nTries, seedRuleIdx);
    return result != "oub" && result != "nondet";
}

bool checkEqualityWrapper(std::string rule1, std::string rule2, int seedRuleIdx) {
    return checkEquality(rule1, rule2, seedRuleIdx);
}

std::string getCoordStr(std::string rule, int seedRuleIdx)
{
    PolycubeSystem* p = new PolycubeSystem(rule);
    p->seed(seedRuleIdx);
    p->processMoves();
    std::string s = p->toString();
    delete p;
    return s;
}

/*
Eigen::Matrix3Xf getCoords(std::string rule, int seedRuleIdx)
{
    PolycubeSystem* p = new PolycubeSystem(rule);
    p->seed(seedRuleIdx);
    p->processMoves();
    Eigen::Matrix3Xf m = p->getCoordMatrix();
    delete p;
    return m;
}
*/

PYBIND11_MODULE(polycubes, m) {
    m.doc() = "Polycube python binding";
    m.def("checkEquality", &checkEqualityWrapper, "Compare if the two rules form the same polycube",
        "rule1"_a, "rule2"_a, "seedRuleIdx"_a = -1
    );
    m.def("isBoundedAndDeterministic", &isBoundedAndDeterministic,
        "Check if the rule is bounded and form the same polycube every time (set nTries to 0 to only check if bounded)",
        "rule"_a, "nTries"_a = 15, "seedRuleIdx"_a = -1
    );
    m.def("getCoordStr", &getCoordStr, "Get coordinate string of assembled polycube", "rule"_a, "seedRuleIdx"_a = -1);
}