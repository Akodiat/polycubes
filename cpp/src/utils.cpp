#include "utils.hpp"

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

