#include "utils.hpp"
#include "polycubeSystem.hpp"

std::string runTries(std::string rule, int nTries, int seedRuleIdx)
{
    int refnCubes = 0;
    PolycubeSystem* ref = nullptr;
    std::string refStr = "";
    while (nTries--) {
        PolycubeSystem* p = new PolycubeSystem(rule);
        p->seed(seedRuleIdx);
        int nCubes = p->processMoves();

        if (nCubes <= 0) {
            delete p;
            if (ref != nullptr) {
                delete ref;
            }
            return "oub";
        }
        if (ref == nullptr) {
            ref = p;
            std::vector<int> b = p->getBoundingBox();
            refStr = std::to_string(nCubes)+"_"+
            std::to_string(b[0])+","+std::to_string(b[1])+","+std::to_string(b[2]);
            refnCubes = nCubes;
        }
        else {
            if (nCubes != refnCubes || !ref->equals(p)) {
                delete p;
                delete ref;
                return "nondet";
            }
            delete p;
        }
    }
    delete ref;
    // If we had the same result every try:
    return refStr;
}

// Compare if the two rules form the same polycube
bool checkEquality(std::string rule, Eigen::Matrix3Xf coords, int seedRuleIdx) {
    PolycubeSystem* p = new PolycubeSystem(rule);
    p->seed(seedRuleIdx);
    int nCubes = p->processMoves();
    bool equal = false;

    if(nCubes >= 0 && nCubes == coords.rows()) {
        equal = p->equals(coords);
    }
    delete p;
    return equal;
}

// Compare if the two rules form the same polycube
bool checkEquality(std::string rule1, std::string rule2, int seedRuleIdx) {
    PolycubeSystem* p1 = new PolycubeSystem(rule1);
    p1->seed(seedRuleIdx);
    int nCubes1 = p1->processMoves();

    PolycubeSystem* p2 = new PolycubeSystem(rule2);
    p2->seed(seedRuleIdx);
    int nCubes2 = p2->processMoves();

    bool equal = false;

    if(nCubes1 >= 0 || nCubes2 >= 0 || nCubes1 == nCubes2) {
        equal = p1->equals(p2);
    }
    delete p1;
    delete p2;
    return equal;
}

// Split string, from https://stackoverflow.com/a/10058725
std::vector<std::string> splitString(std::string s, char delim) {
    std::stringstream ss(s);
    std::string segment;
    std::vector<std::string> list;

    while(std::getline(ss, segment, delim))
    {
        list.push_back(segment);
    }
    return list;
}

// Make any -0 into 0
// Why does roundf even give us -0?
float noNeg0(float f) {
    return f==-0 ? 0 : f;
}

// Turn a vector into a string
std::string vecToStr(Eigen::Vector3f v) {
    std::ostringstream oss;
    oss <<"("<<noNeg0(v.x())<<","<<noNeg0(v.y())<<","<<noNeg0(v.z())<<")";
    return oss.str();
}

// Compare matrices, ignoring column order
bool compCols(Eigen::Matrix3Xf m1, Eigen::Matrix3Xf m2) {
    std::set<std::string> s1, s2;

    assert(m1.cols() == m2.cols());

    for (int col = 0; col < m1.cols(); col++) {
        s1.emplace(vecToStr(m1.col(col)));
        s2.emplace(vecToStr(m2.col(col)));
    }
    
    return s1==s2;
}

// Enumerate all rotation matrices for polycube equality
std::vector<Eigen::Matrix3f> calcAllRotations() {
    std::vector<Eigen::Matrix3f> l(24);
    int i=0;
    l[i++] << 1, 0, 0, 0, 1, 0, 0, 0, 1;
    l[i++] << 0, -1, 0, 1, 0, 0, 0, 0, 1;
    l[i++] << -1, 0, 0, 0, -1, 0, 0, 0, 1;
    l[i++] << 0, 1, 0, -1, 0, 0, 0, 0, 1;
    l[i++] << 0, 0, 1, 0, 1, 0, -1, 0, 0;
    l[i++] << -1, 0, 0, 0, 1, 0, 0, 0, -1;
    l[i++] << 0, 0, -1, 0, 1, 0, 1, 0, 0;
    l[i++] << 1, 0, 0, 0, 0, -1, 0, 1, 0;
    l[i++] << 1, 0, 0, 0, -1, 0, 0, 0, -1;
    l[i++] << 1, 0, 0, 0, 0, 1, 0, -1, 0;
    l[i++] << 0, -1, 0, 0, 0, 1, -1, 0, 0;
    l[i++] << 0, -1, 0, -1, 0, 0, 0, 0, -1;
    l[i++] << 0, -1, 0, 0, 0, -1, 1, 0, 0;
    l[i++] << 0, 0, 1, 1, 0, 0, 0, 1, 0;
    l[i++] << 0, 1, 0, 1, 0, 0, 0, 0, -1;
    l[i++] << 0, 0, -1, 1, 0, 0, 0, -1, 0;
    l[i++] << 0, 0, -1, 0, -1, 0, -1, 0, 0;
    l[i++] << 0, 0, 1, 0, -1, 0, 1, 0, 0;
    l[i++] << -1, 0, 0, 0, 0, 1, 0, 1, 0;
    l[i++] << -1, 0, 0, 0, 0, -1, 0, -1, 0;
    l[i++] << 0, 1, 0, 0, 0, -1, -1, 0, 0;
    l[i++] << 0, 1, 0, 0, 0, 1, 1, 0, 0;
    l[i++] << 0, 0, -1, -1, 0, 0, 0, 1, 0;
    l[i++] << 0, 0, 1, -1, 0, 0, 0, -1, 0;
    return l;
}

