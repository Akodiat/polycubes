// This code is released in public domain

#include "Eigen/Geometry"

// Given two sets of 3D points, find the rotation + translation + scale
// which best maps the first set to the second.
// Source: http://en.wikipedia.org/wiki/Kabsch_algorithm

// The input 3D points are stored as columns.
Eigen::Affine3d Find3DAffineTransform(Eigen::Matrix3Xd in, Eigen::Matrix3Xd out) {

  // Default output
  Eigen::Affine3d A;
  A.linear() = Eigen::Matrix3d::Identity(3, 3);
  A.translation() = Eigen::Vector3d::Zero();

  if (in.cols() != out.cols())
    throw "Find3DAffineTransform(): input data mis-match";

  // First find the scale, by finding the ratio of sums of some distances,
  // then bring the datasets to the same scale.
  double dist_in = 0, dist_out = 0;
  for (int col = 0; col < in.cols()-1; col++) {
    dist_in  += (in.col(col+1) - in.col(col)).norm();
    dist_out += (out.col(col+1) - out.col(col)).norm();
  }
  if (dist_in <= 0 || dist_out <= 0)
    return A;
  double scale = dist_out/dist_in;
  out /= scale;

  // Find the centroids then shift to the origin
  Eigen::Vector3d in_ctr = Eigen::Vector3d::Zero();
  Eigen::Vector3d out_ctr = Eigen::Vector3d::Zero();
  for (int col = 0; col < in.cols(); col++) {
    in_ctr  += in.col(col);
    out_ctr += out.col(col);
  }
  in_ctr /= in.cols();
  out_ctr /= out.cols();
  for (int col = 0; col < in.cols(); col++) {
    in.col(col)  -= in_ctr;
    out.col(col) -= out_ctr;
  }

  // SVD
  Eigen::MatrixXd Cov = in * out.transpose();
  Eigen::JacobiSVD<Eigen::MatrixXd> svd(Cov, Eigen::ComputeThinU | Eigen::ComputeThinV);

  // Find the rotation
  double d = (svd.matrixV() * svd.matrixU().transpose()).determinant();
  if (d > 0)
    d = 1.0;
  else
    d = -1.0;
  Eigen::Matrix3d I = Eigen::Matrix3d::Identity(3, 3);
  I(2, 2) = d;
  Eigen::Matrix3d R = svd.matrixV() * I * svd.matrixU().transpose();

  // The final transform
  A.linear() = scale * R;
  A.translation() = scale*(out_ctr - R*in_ctr);

  return A;
}

bool isEqualFit(Eigen::Matrix3Xd m1, Eigen::Matrix3Xd m2) {
  if (m1.size() != m2.size()) {
    return false;
  }
  Eigen::Affine3d t = Find3DAffineTransform(m1, m2);
  Eigen::Matrix3Xd m1_transf = t * m1;
  double diff = (m2 - m1_transf).cwiseAbs().maxCoeff();
  std::cout<<"(diff="<<diff<<")"<<std::endl;
  Eigen::IOFormat HeavyFmt(Eigen::FullPrecision, 0, ", ", ",\n", "{", "}", "{", "}");
  std::cout << m1.format(HeavyFmt)<<std::endl<<std::endl;
  std::cout << m2.format(HeavyFmt)<<std::endl<<std::endl;
  std::cout << m1_transf.format(HeavyFmt)<<std::endl<<std::endl;
  return diff<1e-13;
}

// A function to test Find3DAffineTransform()

void TestFind3DAffineTransform(){

  // Create datasets with known transform
  Eigen::Matrix3Xd in(3, 100), out(3, 100);
  Eigen::Quaternion<double> Q(1, 3, 5, 2);
  Q.normalize();
  Eigen::Matrix3d R = Q.toRotationMatrix();
  double scale = 2.0;
  for (int row = 0; row < in.rows(); row++) {
    for (int col = 0; col < in.cols(); col++) {
      in(row, col) = log(2*row + 10.0)/sqrt(1.0*col + 4.0) + sqrt(col*1.0)/(row + 1.0);
    }
  }
  Eigen::Vector3d S;
  S << -5, 6, -27;
  for (int col = 0; col < in.cols(); col++)
    out.col(col) = scale*R*in.col(col) + S;

  Eigen::Affine3d A = Find3DAffineTransform(in, out);

  // See if we got the transform we expected
  if ( (scale*R-A.linear()).cwiseAbs().maxCoeff() > 1e-13 ||
       (S-A.translation()).cwiseAbs().maxCoeff() > 1e-13)
    throw "Could not determine the affine transform accurately enough";
}
