import jwt from 'jsonwebtoken';
import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';

export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'changeme');

      if (decoded.role === 'admin') {
        req.user = { role: 'admin', email: decoded.email };
        return next();
      }

      const db = getDb();
      let queryId;
      try {
        queryId = new ObjectId(decoded.id);
      } catch (e) {
        return res.status(401).json({ message: 'Not authorized, invalid token id' });
      }

      const user = await db.collection('users').findOne({ _id: queryId });

      if (!user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      const { password, ...userWithoutPassword } = user;
      req.user = userWithoutPassword;

      next();
    } catch (err) {
      console.error(err);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role ${req.user ? req.user.role : 'none'} is not authorized to access this route`
      });
    }
    next();
  };
};
