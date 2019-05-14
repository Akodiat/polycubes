#pragma once

#include <map>
#include <unordered_map>
#include <string>
#include <random>
#include "../lib/Eigen/Dense"
#include "../lib/Eigen/Geometry"

const size_t ruleSize = 6;

class Face {
private:
    Eigen::Vector3f orientation;
    int* color;
public:
    Face(int color, Eigen::Vector3f orientation){
        this->color = &color;
        this->orientation = orientation;
    }
    Face(Eigen::Vector3f orientation){
        this->color = nullptr;
        this->orientation = orientation;
    }
    Eigen::Vector3f getOrientation(){
        return this->orientation;
    }
    int getColor(){
        return *this->color;
    }
    int setColor(int color) {
        this->color = &color;
    }
};

typedef std::array<Face*,ruleSize> Rule;

struct POTENTIAL_MOVE {
    std::string key;
    size_t dirIdx;
    int val;
    Eigen::Vector3f orientation;
};

class Move {
private:
    Eigen::Vector3f movePos;
    Rule rule;

public:
    Move(Eigen::Vector3f movePos);

    Rule getRule() {
        return this->rule;
    }
    Eigen::Vector3f getMovePos() {
        return this->movePos;
    }
};

class PolycubeSystem {
public:
    PolycubeSystem(std::vector<Rule> rules);
    PolycubeSystem(std::string rules);

    void processMoves();
    void addCube(Eigen::Vector3f position, Rule rule, int ruleIdx);
    
    static std::vector<Eigen::Vector3f> getRuleOrder() {
        std::vector<Eigen::Vector3f> ruleOrder(6); 
        ruleOrder[0] = Eigen::Vector3f( 0,-1, 0);
        ruleOrder[1] = Eigen::Vector3f( 0, 1, 0);
        ruleOrder[2] = Eigen::Vector3f( 0, 0,-1);
        ruleOrder[3] = Eigen::Vector3f( 0, 0, 1);
        ruleOrder[4] = Eigen::Vector3f(-1, 0, 0);
        ruleOrder[5] = Eigen::Vector3f( 1, 0, 0);
        return ruleOrder;
    }

private:
    //Mersenne Twister random number generator
    std::mt19937 randomNumGen;

    std::unordered_map<std::string, Move> moves;
    std::vector<std::string> moveKeys;
    std::map<std::string,bool> cubeMap;
    int maxCoord = 50;

    Eigen::Vector3f ruleOrder[ruleSize];
    std::map<std::string,size_t> ruleToOrderIdx;
    std::vector<Rule> rules;

    Rule* ruleFits(Rule a, Rule b);

    float getSignedAngle(
        Eigen::Vector3f v1,
        Eigen::Vector3f v2,
        Eigen::Vector3f axis
    );

    Rule rotateRule(Rule rule, Eigen::Quaternion<float> q);
    Rule rotateRuleFromTo(Rule rule, Eigen::Vector3f vFrom, Eigen::Vector3f vTo);
    Rule rotateRuleAroundAxis(Rule rule, Eigen::Vector3f axis, float angle);

    unsigned short* shuffleArray(unsigned short a[], size_t size);
    unsigned short* randOrdering(size_t l);
};