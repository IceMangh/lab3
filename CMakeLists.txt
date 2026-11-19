cmake_minimum_required(VERSION 4.0)
project(lab3)

set(CMAKE_CXX_STANDARD 20)

add_executable(lab3 main.cpp
        Graph.h
        Algorithms.h)

include(CTest)
if(BUILD_TESTING)
    add_executable(optional_tests tests/optional.cpp)
    add_test(NAME optional_results COMMAND optional_tests)
endif()
