//#include <python3.6/Python.h>
#include <pybind11/pybind11.h>
#include <pybind11/eigen.h>
#include <pybind11/stl.h>
#include "../polycubeSystem.hpp"
#include "../utils.hpp"

namespace py = pybind11;

using namespace pybind11::literals;

bool isBoundedAndDeterministic(std::string rule, int nTries, std::string assemblyMode, bool isHexString) {
    Result result = runTries(
        rule, nTries,
        parseAssemblyMode(assemblyMode),
        isHexString
    );
    return result.isBounded() && result.isDeterministic();
}

bool checkEqualityWrapper(std::string rule1, std::string rule2, std::string assemblyMode) {
    return checkEquality(
        rule1, rule2,
        parseAssemblyMode(assemblyMode)
    );
}

double assembleRatioWrapper(Eigen::Matrix3Xf coords, std::string rule, int nTries, std::string assemblyMode, bool isHexString) {
    return assembleRatio(
        coords, rule, nTries,
        parseAssemblyMode(assemblyMode),
        isHexString
    );
}

std::string getCoordStr(std::string rule, std::string assemblyMode)
{
    PolycubeSystem* p = new PolycubeSystem(
        rule,
        parseAssemblyMode(assemblyMode)
    );
    p->seed();
    p->processMoves();
    std::string s = p->toString();
    delete p;
    return s;
}


Eigen::Matrix3Xf getCoords(std::string rule, std::string assemblyMode, bool isHexString)
{
    PolycubeSystem* p = new PolycubeSystem(
        isHexString ? parseRules(rule) : parseDecRule(rule),
        parseAssemblyMode(assemblyMode)
    );
    p->seed();
    p->processMoves();
    Eigen::Matrix3Xf m = p->getCoordMatrix();
    delete p;
    return m;
}

std::vector<Eigen::Matrix3Xf> sampleShapes(std::string rule, int nSamples, std::string assemblyMode, bool isHexString) {
    std::vector<Eigen::Matrix3Xf> shapes;
    for (int i=0; i<nSamples; i++) {
        Eigen::Matrix3Xf coords = getCoords(rule, assemblyMode, isHexString);
        bool found = false;
        for (const auto& prevCoords : shapes) {
            if (coordEquality(coords, prevCoords)) {
                found = true;
                break;
            }
        }
        if (!found) {
            shapes.push_back(coords);
        }
    }
    return shapes;
}

PYBIND11_MODULE(libpolycubes, m) {
    m.doc() = "Polycube python binding";
    m.def("checkEquality", &checkEqualityWrapper, "Compare if the two rules form the same polycube",
        "rule1"_a, "rule2"_a, "assemblyMode"_a = "stochastic"
    );
    m.def("assembleRatio", &assembleRatioWrapper, "Calculate the ratio of times the rule assembles into the provided shape",
        "coords"_a, "rule"_a, "nTries"_a = 100, "assemblyMode"_a = "stochastic", "isHexString"_a = true
    );
    m.def("sampleShapes", &sampleShapes, "Sample set of shapes that a rule assembles",
        "rule"_a, "nSamples"_a = 100, "assemblyMode"_a = "stochastic", "isHexString"_a = true
    );
    m.def("isBoundedAndDeterministic", &isBoundedAndDeterministic,
        "Check if the rule is bounded and form the same polycube every time (set nTries to 0 to only check if bounded)",
        "rule"_a, "nTries"_a = 15, "assemblyMode"_a = "stochastic", "isHexString"_a = true
    );
    m.def("getCoordStr", &getCoordStr, "Get coordinate string of assembled polycube", "rule"_a, "assemblyMode"_a = "stochastic");
    m.def("getCoords", &getCoords, "Get coordinates of assembled polycube", "rule"_a, "assemblyMode"_a = "stochastic", "isHexString"_a = true);
}