import SwiftUI

/// The Keled mark, K7 inkdrop (locked 2026-09-25), from keled-office
/// world/shared/brand/mark-k7-smooth-2026-09-25.svg. Same path as the health app header.
struct KeledK7Shape: Shape {
    static let aspect: CGFloat = 67.997 / 91.141

    func path(in rect: CGRect) -> Path {
        let minX: CGFloat = 14.883, minY: CGFloat = 7.606, w: CGFloat = 67.997, h: CGFloat = 91.141
        let k: CGFloat = min(rect.width / w, rect.height / h)
        let ox: CGFloat = rect.minX + (rect.width - w * k) / 2
        let oy: CGFloat = rect.minY + (rect.height - h * k) / 2
        func P(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: ox + (x - minX) * k, y: oy + (y - minY) * k) }
        var p = Path()
        p.move(to: P(31.35, 7.904))
        p.addCurve(to: P(27.396, 10.873), control1: P(29.799, 8.127), control2: P(28.44, 9.148))
        p.addCurve(to: P(24.238, 19.483), control1: P(26.518, 12.324), control2: P(25.803, 14.273))
        p.addCurve(to: P(15.085, 72.783), control1: P(18.928, 37.158), control2: P(15.897, 54.809))
        p.addCurve(to: P(14.885, 81.983), control1: P(14.923, 76.357), control2: P(14.886, 78.072))
        p.addCurve(to: P(15.271, 89.4), control1: P(14.883, 86.565), control2: P(14.94, 87.653))
        p.addCurve(to: P(24.533, 98.643), control1: P(16.214, 94.368), control2: P(19.741, 97.888))
        p.addCurve(to: P(27.467, 98.643), control1: P(25.193, 98.747), control2: P(26.807, 98.747))
        p.addCurve(to: P(35.111, 93.627), control1: P(30.687, 98.135), control2: P(33.414, 96.346))
        p.addCurve(to: P(36.664, 85.15), control1: P(36.579, 91.273), control2: P(37.057, 88.668))
        p.addCurve(to: P(36.183, 81.767), control1: P(36.57, 84.307), control2: P(36.468, 83.586))
        p.addCurve(to: P(34.568, 69.4), control1: P(35.405, 76.798), control2: P(34.981, 73.554))
        p.addCurve(to: P(34.12, 59.017), control1: P(34.089, 64.578), control2: P(33.984, 62.149))
        p.addCurve(to: P(34.079, 54.817), control1: P(34.184, 57.54), control2: P(34.168, 55.897))
        p.addCurve(to: P(34.093, 51.017), control1: P(33.985, 53.673), control2: P(33.992, 51.648))
        p.addCurve(to: P(35.625, 47.493), control1: P(34.326, 49.545), control2: P(34.91, 48.203))
        p.addCurve(to: P(37.4, 46.812), control1: P(36.228, 46.894), control2: P(36.531, 46.778))
        p.addCurve(to: P(38.033, 46.856), control1: P(37.684, 46.823), control2: P(37.969, 46.843))
        p.addCurve(to: P(40.1, 46.822), control1: P(38.283, 46.908), control2: P(39.7, 46.884))
        p.addCurve(to: P(44.65, 44.974), control1: P(41.466, 46.61), control2: P(42.566, 46.163))
        p.addCurve(to: P(69.333, 26.97), control1: P(50.912, 41.401), control2: P(58.48, 35.881))
        p.addCurve(to: P(75.875, 20.895), control1: P(73.7, 23.385), control2: P(74.814, 22.35))
        p.addCurve(to: P(76.852, 12.817), control1: P(77.743, 18.33), control2: P(78.093, 15.442))
        p.addCurve(to: P(73.433, 9.272), control1: P(76.139, 11.307), control2: P(74.924, 10.048))
        p.addCurve(to: P(63.966, 11.269), control1: P(70.271, 7.627), control2: P(66.553, 8.411))
        p.addCurve(to: P(60.567, 16.217), control1: P(62.948, 12.393), control2: P(62.414, 13.171))
        p.addCurve(to: P(38.25, 43.076), control1: P(52.419, 29.65), control2: P(44.768, 38.859))
        p.addCurve(to: P(35.538, 43.349), control1: P(36.89, 43.956), control2: P(36.249, 44.021))
        p.addCurve(to: P(34.049, 37.533), control1: P(34.498, 42.369), control2: P(33.963, 40.279))
        p.addCurve(to: P(36.067, 18.683), control1: P(34.179, 33.357), control2: P(34.994, 25.743))
        p.addCurve(to: P(36.612, 13.783), control1: P(36.561, 15.432), control2: P(36.611, 14.981))
        p.addCurve(to: P(36.179, 10.99), control1: P(36.614, 12.598), control2: P(36.491, 11.806))
        p.addCurve(to: P(31.35, 7.904), control1: P(35.365, 8.855), control2: P(33.411, 7.606))
        p.closeSubpath()
        p.move(to: P(41.582, 55.439))
        p.addCurve(to: P(40.294, 56.028), control1: P(41.067, 55.482), control2: P(40.609, 55.691))
        p.addCurve(to: P(39.908, 56.95), control1: P(40.009, 56.334), control2: P(39.926, 56.532))
        p.addCurve(to: P(43.017, 61.226), control1: P(39.862, 58.027), control2: P(40.556, 58.983))
        p.addCurve(to: P(47.517, 65.667), control1: P(45.016, 63.048), control2: P(46.163, 64.18))
        p.addCurve(to: P(58.879, 82.5), control1: P(51.927, 70.508), control2: P(55.615, 75.973))
        p.addCurve(to: P(61.6, 88.617), control1: P(59.968, 84.678), control2: P(60.497, 85.867))
        p.addCurve(to: P(63.471, 92.662), control1: P(62.494, 90.845), control2: P(62.895, 91.712))
        p.addCurve(to: P(70.75, 97.622), control1: P(65.152, 95.437), control2: P(67.7, 97.173))
        p.addCurve(to: P(73.25, 97.622), control1: P(71.313, 97.705), control2: P(72.687, 97.705))
        p.addCurve(to: P(81.365, 85.521), control1: P(79.076, 96.765), control2: P(82.88, 91.093))
        p.addCurve(to: P(77.975, 80.222), control1: P(80.84, 83.59), control2: P(79.701, 81.81))
        p.addCurve(to: P(73.967, 77.013), control1: P(77.127, 79.443), control2: P(76.513, 78.951))
        p.addCurve(to: P(71.367, 75.013), control1: P(73.316, 76.517), control2: P(72.146, 75.618))
        p.addCurve(to: P(46.951, 57.617), control1: P(60.969, 66.948), control2: P(54.079, 62.038))
        p.addCurve(to: P(41.582, 55.439), control1: P(44.031, 55.806), control2: P(42.863, 55.332))
        p.closeSubpath()
        return p
    }
}
