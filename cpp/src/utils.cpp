#include "utils.hpp"
#include "polycubeSystem.hpp"

std::string assemblyModeToString(AssemblyMode m) {
    const char* assemblyModeNames[] = {"stochastic", "seeded", "ordered" };
    return assemblyModeNames[m];
}

AssemblyMode parseAssemblyMode(std::string s) {
    AssemblyMode m;
    if (s == "stochastic") m = AssemblyMode::stochastic;
    else if (s == "seeded") m = AssemblyMode::seeded;
    else if (s == "ordered") m = AssemblyMode::ordered;
    else {
        throw std::invalid_argument("Unknown assembly mode: "+s);
    }
    return m;
}

std::vector<Rule> parseDecRule(std::string ruleStr) {
    std::vector<Rule> rules;
    for (std::string s : splitString(ruleStr, '_')) {
        Rule rule;
        int i = 0;
        for (std::string face : splitString(s, '|')) {
            int color, orientation;
            if (face == "") {
                color = orientation = 0;
            } else {
                std::vector<std::string> values = splitString(face, ':');
                color = std::stoi(values[0]);
                orientation = std::stoi(values[1]);
            }
            rule[i] = new Face(color, getOrientation(i, orientation));
            i++;
        }
        rules.push_back(rule);
    }
    return rules;
}

std::vector<Rule> parseRules(std::string ruleStr) {
    if (ruleStr.size() % 2*ruleSize != 0) {
        std::cerr<<"Error: Incomplete rule: "<<ruleStr<<std::endl;
        exit(EXIT_FAILURE);
    }
    std::vector<Rule> rules;
    for(size_t i = 0; i<ruleStr.size(); i+=2*ruleSize) {
        Rule rule;
        //std::cout<<"Rule "<<(i/(2*ruleSize))+1<<std::endl;
        for(size_t j = 0; j<ruleSize; j++) {
            std::string s = ruleStr.substr(i+(2*j), 2);
            int hex = std::stoi(s, 0, 16);
            std::bitset<8> bitset(hex);
            std::bitset<8> colorMask(0b01111100);
            std::bitset<8> orientationMask(0b00000011);
            int color = ((bitset & colorMask) >> 2).to_ulong();
            if(bitset[7]) color *= -1; // Why is there no .to_long()?
            int orientation = (bitset & orientationMask).to_ulong();
            //std::cout<<"Colour: "<<color<<"\t Orientation: "<<orientation<<std::endl;
            rule[j] = new Face(color, getOrientation(j, orientation));
        }
        rules.push_back(rule);
        //std::cout<<std::endl;
    }
    return rules;
}

double assembleRatio(Eigen::Matrix3Xf coords, std::string rulestr, int nTries, AssemblyMode assemblyMode, bool ruleIsHex
) {
    int nEqual = 0;

    for (int i=0; i<nTries; i++) {
        if (checkEquality(rulestr, coords, assemblyMode, ruleIsHex)) {
            nEqual++;
        }
    }
    // If we had the same result every try:
    return double(nEqual)/nTries;
}

Result runTries(std::string rule, int nTries, AssemblyMode assemblyMode) {
    return runTries(rule, nTries, assemblyMode, true);
}

Result runTries(std::string rulestr, int nTries, AssemblyMode assemblyMode, bool ruleIsHex)
{
    int refnCubes = 0;
    Eigen::Matrix3Xf coords;
    std::string refStr = "";
    std::vector<int> refDims;

    std::vector<Rule> rule;

    while (nTries--) {
        PolycubeSystem* p = new PolycubeSystem(ruleIsHex ? parseRules(rulestr) : parseDecRule(rulestr), assemblyMode);
        p->seed();
        int nCubes = p->processMoves();

        if (nCubes <= 0) {
            delete p;
            // Not bounded
            return Result(false, true);
        }
        if (refStr == "") {
            coords = p->getCoordMatrix();
            refDims = p->getBoundingBox();
            refStr = p->toString();
            refnCubes = nCubes;
        }
        else {
            if (nCubes != refnCubes || !p->equals(coords)) {
                delete p;
                // Not deterministic
                return Result(true, false);
            }
        }
        delete p;
    }
    // If we had the same result every try:
    return Result(refnCubes, refDims);
}

// Compare if the two rules form the same polycube
bool checkEquality(std::string rule, Eigen::Matrix3Xf coords, AssemblyMode assemblyMode) {
    return checkEquality(rule, coords, assemblyMode, true);
}

bool checkEquality(std::string rule, Eigen::Matrix3Xf coords, AssemblyMode assemblyMode, bool ruleIsHex) {
    PolycubeSystem* p = new PolycubeSystem(ruleIsHex ? parseRules(rule) : parseDecRule(rule), assemblyMode);
    p->seed();
    int nCubes = p->processMoves();
    bool equal = false;

    if(nCubes >= 0 && nCubes == coords.cols()) {
        equal = p->equals(coords);
    }
    delete p;
    return equal;
}

// Compare if the two rules form the same polycube
bool checkEquality(std::string rule1, std::string rule2, AssemblyMode assemblyMode) {
    PolycubeSystem* p1 = new PolycubeSystem(rule1, assemblyMode);
    p1->seed();
    int nCubes1 = p1->processMoves();

    PolycubeSystem* p2 = new PolycubeSystem(rule2, assemblyMode);
    p2->seed();
    int nCubes2 = p2->processMoves();

    bool equal = false;

    if(nCubes1 >= 0 || nCubes2 >= 0 || nCubes1 == nCubes2) {
        equal = p1->equals(p2);
    }
    delete p1;
    delete p2;
    return equal;
}

bool coordEquality(Eigen::Matrix3Xf m1, Eigen::Matrix3Xf m2) {
    if (m1.size() != m2.size()) {
        return false;
    }

    // Find the centroids then shift to the origin
    Eigen::Vector3f m1_ctr = Eigen::Vector3f::Zero();
    Eigen::Vector3f m2_ctr = Eigen::Vector3f::Zero();
    for (int col = 0; col < m1.cols(); col++) {
        m1_ctr += m1.col(col);
        m2_ctr += m2.col(col);
    }
    m1_ctr /= m1.cols();
    m2_ctr /= m2.cols();
    for (int col = 0; col < m1.cols(); col++) {
        m1.col(col) -= m1_ctr;
        m2.col(col) -= m2_ctr;
    }

    std::vector<Eigen::Matrix3f> rots = calcAllRotations();

    int nrot = rots.size();
    for(int i=0; i<nrot; i++) {
        if (compCols(m1, rots[i]*m2)) {
            return true;
        }
    }

    return false;
}

Eigen::Vector3f getOrientation(int index, int orientation) {
    Eigen::Vector3f v;
    switch (index) {
        case 0: v = Eigen::Vector3f( 0,-1, 0); break;
        case 1: v = Eigen::Vector3f( 0, 1, 0); break;
        case 2: v = Eigen::Vector3f( 0, 0,-1); break;
        case 3: v = Eigen::Vector3f( 0, 0, 1); break;
        case 4: v = Eigen::Vector3f(-1, 0, 0); break;
        case 5: v = Eigen::Vector3f( 1, 0, 0); break;
    default:
        throw std::out_of_range("Index should be in interval 0-5");
    }
    const Eigen::Vector3f dir = PolycubeSystem::getRuleOrder(index);
    const float angle = ((float) orientation) * M_PI_2;
    Eigen::AngleAxis<float> a = Eigen::AngleAxis<float>(
        angle, dir
    );
    Eigen::Quaternion<float> q = Eigen::Quaternion<float>(a);
    return (q*v);
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

