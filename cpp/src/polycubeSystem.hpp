#pragma once

#include <map>
#include <unordered_map>
#include <unordered_set>
#include <string>
#include <algorithm>
#include <random>
#include <iostream>
#include <chrono>
#include <Eigen/Dense>
#include <Eigen/Geometry>

const size_t ruleSize = 6;

enum AssemblyMode {stochastic, seeded, ordered};

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
    void setColor(int color)
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
        for(size_t i=0; i<ruleSize; i++) {
            delete rule[i];
        }
    }
};

class PolycubeSystem
{
public:
    PolycubeSystem(std::vector<Rule> rules);
    PolycubeSystem(std::vector<Rule> rules, size_t nMaxCubes);
    PolycubeSystem(std::vector<Rule> rules, AssemblyMode assemblyMode);
    PolycubeSystem(std::vector<Rule> rules, AssemblyMode assemblyMode, size_t nMaxCubes);
    PolycubeSystem(std::string rules);
    PolycubeSystem(std::string rules, size_t nMaxCubes);
    PolycubeSystem(std::string rules, size_t nMaxCubes, AssemblyMode assemblyMode);
    PolycubeSystem(std::string rules, AssemblyMode assemblyMode);
    ~PolycubeSystem();

    int processMoves();
    void seed();
    void addCube(Eigen::Vector3f position, Rule rule, int ruleIdx);
    void addCube(Eigen::Vector3f position, int ruleIdx);
    std::string toString();
    int getNMaxCubes() {
        return this->nMaxCubes;
    }

    Eigen::Matrix3Xf getCoordMatrix();
    std::vector<int> getBoundingBox();

    bool isInteresting() {
        return true;
    }

    void setTorsion(bool torsion) {
        this->torsion = torsion;
    }

    bool equals(PolycubeSystem *other);
    bool equals(Eigen::Matrix3Xf m2);

    static Eigen::Vector3f getRuleOrder(int index);

private:
    //Mersenne Twister random number generator
    std::mt19937 randomNumGen;

    std::unordered_map<std::string, Move> moves;
    std::vector<std::string> moveKeys;
    std::map<std::string, bool> cubeMap;
    size_t nMaxCubes;

    bool torsion;

    Eigen::Vector3f ruleOrder[ruleSize];
    std::map<std::string, size_t> ruleToOrderIdx;
    std::vector<Rule> rules;

    AssemblyMode assemblyMode;
    size_t orderIndex;

    int tryProcessMove(std::string movekey, int ruleIdx);
    void init(std::vector<Rule> rules, size_t nMaxCubes, AssemblyMode assemblyMode);

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