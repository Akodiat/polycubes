#include "polycubeSystem.hpp"
#include <bitset>

// Make any -0 into 0
// Why does roundf even give us -0?
float noNeg0(float f) {
    return f==-0 ? 0 : f;
}

std::string vecToStr(Eigen::Vector3f v) {
    std::ostringstream oss;
    oss <<"("<<noNeg0(v.x())<<","<<noNeg0(v.y())<<","<<noNeg0(v.z())<<")";
    return oss.str();
}

Move::Move(Eigen::Vector3f movePos) {
    this->movePos = movePos;
    this->rule = Rule();
    // Initialize with default orientations
    std::vector<Eigen::Vector3f> ruleOrder = PolycubeSystem::getRuleOrder();
    for (int i=0; i<ruleSize; i++) {
        this->rule[i] = new Face(ruleOrder[i]);
    }
}

PolycubeSystem::PolycubeSystem(std::vector<Rule> rules) {
    init(rules, 100);
}

PolycubeSystem::PolycubeSystem(std::string rules) {
    init(parseRules(rules), 100);
}
PolycubeSystem::PolycubeSystem(std::string rules, int nMaxCubes) {
    init(parseRules(rules), nMaxCubes);
}

void PolycubeSystem::init(std::vector<Rule> rules, int nMaxCubes) {
    this->moves = std::unordered_map<std::string, Move>();
    this->moveKeys = std::vector<std::string>();
    this->cubeMap = std::map<std::string,bool>();
    this->maxCoord = 50;
    this->nMaxCubes = nMaxCubes;
    this->rules = rules;

    this->ruleOrder[0] = Eigen::Vector3f(-1, 0, 0);
    this->ruleOrder[1] = Eigen::Vector3f( 1, 0, 0);
    this->ruleOrder[2] = Eigen::Vector3f( 0,-1, 0);
    this->ruleOrder[3] = Eigen::Vector3f( 0, 1, 0);
    this->ruleOrder[4] = Eigen::Vector3f( 0, 0,-1);
    this->ruleOrder[5] = Eigen::Vector3f( 0, 0, 1);

    // Create reverse map of rule order
    for (size_t i=0; i<ruleSize; i++) {
        Eigen::Vector3f* r = this->ruleOrder + i;
        this->ruleToOrderIdx[vecToStr(*r)] = i;
    }
}

int PolycubeSystem::processMoves() {
    // While we have moves to process
    while (this->moveKeys.size() > 0) {
        // Pick a random move
        std::uniform_int_distribution<uint32_t> key_distribution(
            0, this->moveKeys.size()-1
        );
        size_t keyIdx = key_distribution(this->randomNumGen);
        std::string key = this->moveKeys[keyIdx];

        // Pick a random rule order
        std::vector<unsigned short> ruleIdxs = this->randOrdering(this->rules.size());
        // Check if we have a rule that fits this move
        for (size_t r=0; r<this->rules.size(); r++) {
            Rule rule = this->rules[ruleIdxs[r]];
            Move move = this->moves.at(key);
            Rule* fittedRule = ruleFits(move.getRule(), rule);
            if(fittedRule != nullptr) {
                this->addCube(move.getMovePos(), *fittedRule, ruleIdxs[r]);
                if (this->cubeMap.size() >= this->nMaxCubes) {
                    std::cerr<<"Polycube is larger than a "<<this->nMaxCubes<<"-mer, aborting"<<std::endl;
                    return -1;
                }
                break;
            }
        }
        // Remove processed move
        this->moves.erase(key);
        this->moveKeys.erase(std::find(this->moveKeys.begin(), this->moveKeys.end(), key));
        std::cout<<"Moves to process: "<<this->moveKeys.size()<<std::endl<<std::endl;
    }
    return this->cubeMap.size();
}

// Add cube with default orientation
void PolycubeSystem::addCube(Eigen::Vector3f position, int ruleIdx) {
    Rule rule = this->rules[ruleIdx];
    return this->addCube(position, rule, ruleIdx);
}
// Need both rule and ruleIdx to determine color as the rule might be rotated
void PolycubeSystem::addCube(Eigen::Vector3f position, Rule rule, int ruleIdx) {
    std::cout<<"About to add cube at "<<vecToStr(position)<<" (rule #"<<ruleIdx<<")"<<std::endl;
    // Go through all non-zero parts of the rule and add potential moves
    std::vector<POTENTIAL_MOVE> potentialMoves;
    for (size_t i=0; i<ruleSize; i++) {
        std::cout<<rule[i]->getColor() <<" ";
    }
    std::cout<<std::endl;

    for (size_t i=0; i<ruleSize; i++) {
        if (rule[i]->getColor() == 0) {
            continue;
        }
        Eigen::Vector3f direction = this->ruleOrder[i] * -1;
        Eigen::Vector3f movePos = position - direction;
        if (abs(movePos.x()) > this->maxCoord ||
            abs(movePos.y()) > this->maxCoord ||
            abs(movePos.z()) > this->maxCoord)
        {
            // Neigbour outside of bounding box, stopping here
            continue;
        }
        std::string key = vecToStr(movePos);

        if (this->cubeMap.find(key) != this->cubeMap.end()) {
            // There is already a cube at pos,
            // no need to add this neigbour to moves
            continue;
        }

        if (this->moves.find(key) == this->moves.end()) {
            this->moves.emplace(key, Move(movePos));
            this->moveKeys.push_back(key);
        }
        Eigen::Vector3f r = position - movePos;
        size_t dirIdx = this->ruleToOrderIdx[vecToStr(r)];
/*
        //Make sure we haven't written anything here before:
        try {
            this->moves.at(key).getRule().at(dirIdx);
            return;
        } catch (const std::exception&) {
            // If we couldn't find anything, all is well
        }
*/
        POTENTIAL_MOVE potMove;
        potMove.key = key;
        potMove.dirIdx = dirIdx;
        potMove.val = rule[i]->getColor()*-1;
        potMove.orientation = rule[i]->getOrientation();

        potentialMoves.push_back(potMove);
        std::cout<<"\tAdd move to neigbour at "<<key<<" (val = "<<potMove.val<<")"<<std::endl;
    }
    for (size_t i=0; i<potentialMoves.size(); i++) {
        POTENTIAL_MOVE m = potentialMoves[i];
        Face* f = new Face(m.val, m.orientation);
        this->moves.at(m.key).setRuleAt(m.dirIdx, f);
    }

    this->cubeMap[vecToStr(position)] = true;
}

std::vector<Eigen::Vector3f> PolycubeSystem::getRuleOrder() {
    std::vector<Eigen::Vector3f> ruleOrder(6);
    ruleOrder[0] = Eigen::Vector3f( 0,-1, 0);
    ruleOrder[1] = Eigen::Vector3f( 0, 1, 0);
    ruleOrder[2] = Eigen::Vector3f( 0, 0,-1);
    ruleOrder[3] = Eigen::Vector3f( 0, 0, 1);
    ruleOrder[4] = Eigen::Vector3f(-1, 0, 0);
    ruleOrder[5] = Eigen::Vector3f( 1, 0, 0);
    return ruleOrder;
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
        break;
    }
    const std::vector<Eigen::Vector3f> ruleOrder = PolycubeSystem::getRuleOrder();
    const Eigen::Vector3f dir = ruleOrder[index];
    const float angle = ((float) orientation) * M_PI_2;
    Eigen::AngleAxis<float> a = Eigen::AngleAxis<float>(
        angle, dir
    );
    Eigen::Quaternion<float> q = Eigen::Quaternion<float>(a);
    return (q*v);
}

std::vector<Rule> PolycubeSystem::parseRules(std::string ruleStr) {
    if (ruleStr.size() % 2*ruleSize != 0) {
        std::cerr<<"Error: Incomplete rule"<<std::endl;
        exit(EXIT_FAILURE);
    }
    std::vector<Rule> rules;
    for(size_t i = 0; i<ruleStr.size(); i+=2*ruleSize) {
        Rule rule;
        std::cout<<"Rule "<<(i/(2*ruleSize))+1<<std::endl;
        for(size_t j = 0; j<ruleSize; j++) {
            std::string s = ruleStr.substr(i+(2*j), 2);
            int hex = std::stoi(s, 0, 16);
            std::bitset<8> bitset(hex);
            std::bitset<8> colorMask(0b01111100);
            std::bitset<8> orientationMask(0b00000011);
            int color = ((bitset & colorMask) >> 2).to_ulong();
            if(bitset[7]) color *= -1; // Why is there no .to_long()?
            int orientation = (bitset & orientationMask).to_ulong();
            std::cout<<"Colour: "<<color<<"\t Orientation: "<<orientation<<std::endl;
            rule[j] = new Face(color, getOrientation(j, orientation));
        }
        rules.push_back(rule);
        std::cout<<std::endl;
    }
    return rules;
}

Rule* PolycubeSystem::ruleFits(Rule a, Rule b) {
    std::vector<unsigned short> ra = this->randOrdering(ruleSize);
    std::vector<unsigned short> rb = this->randOrdering(ruleSize);
    for (unsigned short ria=0; ria<ruleSize; ria++) {
        unsigned short i = ra[ria];

        if (a[i]->hasColor() && a[i]->getColor() != 0) {
            for (unsigned short rib=0; rib<ruleSize; rib++) {
                unsigned short j = rb[rib];
                if (a[i]->getColor() == b[j]->getColor()) {
                    //TODO: is the original pointer updated?
                    // https://stackoverflow.com/a/766905
                    b = this->rotateRuleFromTo(b, 
                        this->ruleOrder[j],
                        this->ruleOrder[i]);
                    b = this->rotateRuleAroundAxis(b, 
                        this->ruleOrder[i],
                        - this->getSignedAngle(
                            a[i]->getOrientation(),
                            b[i]->getOrientation(),
                            this->ruleOrder[i]
                        )
                    );
                    return new Rule(b);
                }
            }
        }
    }
    return nullptr;
}

// https://stackoverflow.com/a/16544330
float PolycubeSystem::getSignedAngle(
        Eigen::Vector3f v1,
        Eigen::Vector3f v2,
        Eigen::Vector3f axis)
{
    float dot = v1.dot(v2);
    float det = axis.dot(v1.cross(v2));
    float a = atan2(det, dot);
    // std::cout<<"The angle from "<<vecToStr(v1)<<" to "<<vecToStr(v2)<<" around axis "<<vecToStr(axis)<<" is "<<a<<" ("<<a*M_1_PI*180<<" degrees)"<<std::endl;
    return a;
}


//https://stackoverflow.com/a/25199671
Rule PolycubeSystem::rotateRule(Rule rule, Eigen::Quaternion<float> q) {
    Rule newRule = Rule();
    for (size_t i=0; i<ruleSize; i++) {
        Eigen::Vector3f face = this->ruleOrder[i];
        Eigen::Vector3f newFace = q * face;
        Eigen::Vector3f newFaceDir = q * rule[i]->getOrientation();
        // std::cout<<vecToStr(face)<<" rotates into "<<vecToStr(newFace)<<std::endl;
        newFace = Eigen::Vector3f(
            roundf(newFace.x()),
            roundf(newFace.y()),
            roundf(newFace.z())
        );
        std::string key = vecToStr(newFace);
        int iNewFace = this->ruleToOrderIdx.at(key);
        newRule[iNewFace] = new Face(rule[i]->getColor(), newFaceDir);
    }
    return newRule;
}
//https://stackoverflow.com/a/25199671
Rule PolycubeSystem::rotateRuleFromTo(
    Rule rule, Eigen::Vector3f vFrom, Eigen::Vector3f vTo)
{
    // create one quaternion and reuse it
    Eigen::Quaternion<float> quaternion = Eigen::Quaternion<float>().FromTwoVectors(vFrom,vTo);
    return this->rotateRule(rule, quaternion);
}
Rule PolycubeSystem::rotateRuleAroundAxis(Rule rule, Eigen::Vector3f axis, float angle) {
    Eigen::AngleAxis<float> angleAxis = Eigen::AngleAxis<float>(angle, axis);
    Eigen::Quaternion<float> quaternion = Eigen::Quaternion<float>(angleAxis);
    return this->rotateRule(rule, quaternion);
}

// From stackoverflow/a/12646864
std::vector<unsigned short> PolycubeSystem::shuffleArray(std::vector<unsigned short> a) {
    for (size_t i = a.size()-1; i>0; i--) {
        std::uniform_int_distribution<size_t> rnd_dist(0, i+1);
        size_t j = rnd_dist(randomNumGen);
        unsigned short temp = a[i];
        a[i] = a[j];
        a[j] = temp;
    }
    return a;
}

std::vector<unsigned short> PolycubeSystem::randOrdering(size_t size) {
    std::vector<unsigned short> a(size);
    for (size_t i=0; i<size; i++)
        a[i]=i;

    for (size_t i = size-1; i>0; i--) {
        std::uniform_int_distribution<size_t> rnd_dist(0, i);
        size_t j = rnd_dist(randomNumGen);
        unsigned short temp = a[i];
        a[i] = a[j];
        a[j] = temp;
    }
    return a;
}

std::string PolycubeSystem::toString() {
    std::string s;
    std::map<std::string, bool>::iterator it;

    for (it= this->cubeMap.begin(); it!=this->cubeMap.end(); it++) {
        s += it->first;
        s += "\n";
    }
    return s;
}


