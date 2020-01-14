#pragma once

#include <map>
#include <unordered_map>
#include <string>
#include <random>
#include <iostream>
#include <chrono>
#include "../lib/Eigen/Dense"
#include "../lib/Eigen/Geometry"

class PolycubeResult
{
private:
    std::string rule;
    std::string suffix;
public:
    PolycubeResult(std::string rule, std::string suffix) {
        this->rule = rule;
        this->suffix = suffix;
    }
    std::string toString() {
        return this->rule + '.' + this->suffix;
    };

    std::string getSuffix() {
        return this->suffix;
    }

    virtual bool isInteresting() {
        return false;
    }
};

class InterestingPolycubeResult: public PolycubeResult
{
private:
    std::string coords;
public:
    InterestingPolycubeResult(std::string rule, int polycubeSize, std::string coords): PolycubeResult(rule, std::to_string(polycubeSize) + "-mer")
    {
        this->coords = coords;
    }
    std::string getCoords() {
        return this->coords;
    }
    bool isInteresting() {
        return true;
    }
};

const size_t ruleSize = 6;

class Face
{
private:
    Eigen::Vector3f orientation;
    int *color;

public:
    Face(int color, Eigen::Vector3f orientation)
    {
        this->color = new int(color);
        this->orientation = orientation;
    }
    Face(Eigen::Vector3f orientation)
    {
        this->color = nullptr;
        this->orientation = orientation;
    }
    ~Face()
    {
        delete color;
    }
    Eigen::Vector3f getOrientation()
    {
        return this->orientation;
    }
    bool hasColor()
    {
        return this->color != nullptr;
    }
    int getColor()
    {
        return *(this->color);
    }
    int setColor(int color)
    {
        this->color = &color;
    }
};

typedef std::array<Face *, ruleSize> Rule;

struct POTENTIAL_MOVE
{
    std::string key;
    size_t dirIdx;
    int val;
    Eigen::Vector3f orientation;
};

class Move
{
private:
    Eigen::Vector3f movePos;
    Rule rule;

public:
    Move(Eigen::Vector3f movePos);

    Rule getRule()
    {
        return this->rule;
    }
    Eigen::Vector3f getMovePos()
    {
        return this->movePos;
    }
    void setRuleAt(int i, Face *f)
    {
        delete rule[i];
        rule[i] = f;
    }
    void deleteRules(){
        for(int i=0; i<ruleSize; i++) {
            delete rule[i];
        }
    }
};

class PolycubeSystem
{
public:
    PolycubeSystem(std::vector<Rule> rules);
    PolycubeSystem(std::string rules);
    PolycubeSystem(std::string rules, int nMaxCubes);
    ~PolycubeSystem();

    int processMoves();
    void addCube(Eigen::Vector3f position, Rule rule, int ruleIdx);
    void addCube(Eigen::Vector3f position, int ruleIdx);
    std::string toString();
    int getNMaxCubes() {
        return this->nMaxCubes;
    }

    static Eigen::Vector3f getRuleOrder(int index);
    static std::vector<Rule> parseRules(std::string ruleStr);

private:
    //Mersenne Twister random number generator
    std::mt19937 randomNumGen;

    std::unordered_map<std::string, Move> moves;
    std::vector<std::string> moveKeys;
    std::map<std::string, bool> cubeMap;
    int nMaxCubes;

    Eigen::Vector3f ruleOrder[ruleSize];
    std::map<std::string, size_t> ruleToOrderIdx;
    std::vector<Rule> rules;

    void init(std::vector<Rule> rules, int nMaxCubes);

    Rule *ruleFits(Rule a, Rule b);

    float getSignedAngle(
        Eigen::Vector3f v1,
        Eigen::Vector3f v2,
        Eigen::Vector3f axis);

    Rule rotateRule(Rule rule, Eigen::Quaternion<float> q);
    Rule rotateRuleFromTo(Rule rule, Eigen::Vector3f vFrom, Eigen::Vector3f vTo);
    Rule rotateRuleAroundAxis(Rule rule, Eigen::Vector3f axis, float angle);

    std::vector<unsigned short> shuffleArray(std::vector<unsigned short> a);
    std::vector<unsigned short> randOrdering(size_t size);
};