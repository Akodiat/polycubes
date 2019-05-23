#include "polycubeSystem.hpp"

std::string vecToStr(Eigen::Vector3f v) {
    std::ostringstream oss;
    oss <<"("<<v.x()<<","<<v.y()<<","<<v.z()<<")";
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
    this->moves = std::unordered_map<std::string, Move>();
    this->moveKeys = std::vector<std::string>();
    this->cubeMap = std::map<std::string,bool>();
    this->maxCoord = 50;
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

void PolycubeSystem::processMoves() {
    // While we have moves to process
    while (this->moveKeys.size() > 0) {
        // Pick a random move
        std::uniform_int_distribution<uint32_t> key_distribution(
            0, this->moveKeys.size()-1
        );
        size_t keyIdx = key_distribution(this->randomNumGen);
        std::string key = this->moveKeys[keyIdx];

        // Pick a random rule order
        std::array<unsigned short, ruleSize> ruleIdxs = this->randRuleOrdering();
        // Check if we have a rule that fits this move
        for (size_t r=0; r<ruleSize; r++) {
            Rule rule = this->rules[ruleIdxs[r]];
            Move move = this->moves.at(key);
            if(this->ruleFits(move.getRule(), rule)) {
                this->addCube(move.getMovePos(), rule, ruleIdxs[r]);
                // Remove processed move
                this->moves.erase(key);
                break;
            }
        }
    }
}

//Need both rule and ruleIdx to determine color as the rule might be rotated
void PolycubeSystem::addCube(Eigen::Vector3f position, Rule rule, int ruleIdx) {
    // Go through all non-zero parts of the rule and add potential moves
    std::vector<POTENTIAL_MOVE> potentialMoves;
    for (size_t i=0; i<ruleSize; i++) {
        if (rule[i]->getColor() == 0) {
            continue;
        }
        Eigen::Vector3f direction = this->ruleOrder[i] *= -1;
        Eigen::Vector3f movePos = position + this->ruleOrder[i];
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
        size_t dirIdx = this->ruleToOrderIdx[key];
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

Rule* PolycubeSystem::ruleFits(Rule a, Rule b) {
    std::array<unsigned short, ruleSize> ra = this->randRuleOrdering();
    std::array<unsigned short, ruleSize> rb = this->randRuleOrdering();
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
                        this->ruleOrder[i]));
                    return new Rule(b);
                }
            }
        }
    }
    return nullptr;
}

float PolycubeSystem::getSignedAngle(
        Eigen::Vector3f v1,
        Eigen::Vector3f v2,
        Eigen::Vector3f axis)
{
    Eigen::Vector3f s = v1.cross(v2);
    float c = v1.dot(v2);
    // float a = atan2(s.length(), c);
    float a = atan2(1.f, c);
    if (s != axis) {
        a *= -1;
    }
    return a;
}


//https://stackoverflow.com/a/25199671
Rule PolycubeSystem::rotateRule(Rule rule, Eigen::Quaternion<float> q) {
    Rule newRule = Rule();
    for (size_t i=0; i<ruleSize; i++) {
        Eigen::Vector3f face = this->ruleOrder[i];
        Eigen::Vector3f newFace = q * face;
        Eigen::Vector3f newFaceDir = q* rule[i]->getOrientation();
        int iNewFace = this->ruleToOrderIdx[vecToStr(newFace)];
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
std::array<unsigned short, ruleSize> PolycubeSystem::shuffleArray(std::array<unsigned short, ruleSize> a) {
    for (size_t i = ruleSize-1; i>0; i--) {
        std::uniform_int_distribution<size_t> rnd_dist(0, i+1);
        size_t j = rnd_dist(randomNumGen);
        unsigned short temp = a[i];
        a[i] = a[j];
        a[j] = temp;
    }
}

std::array<unsigned short, ruleSize> PolycubeSystem::randRuleOrdering() {
    std::array<unsigned short, ruleSize> a;
    for (size_t i=0; i<ruleSize; i++) {
        a[i]=i;
    }
    this->shuffleArray(a);
    return a;
}


