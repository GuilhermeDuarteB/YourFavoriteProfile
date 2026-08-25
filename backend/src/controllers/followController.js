import { followUser, unfollowUser } from '../models/followModel.js';
import { findUserByUsername as getUser } from '../models/userModel.js';

export async function postFollow(req,res){
    try{
        const target = await getUser(req.params.username);
        if(!target) return res.status(404).json({message: 'User not found'});
        if(target.id === req.userId) return res.status(400).json({message: 'You cannot follow yourself'});

        await followUser(req.userId, target.id);
        res.status(201).json({following: true});
    }catch (err){
        console.error(err);
        res.status(500).json({message: 'Internal server error'});
    }
}

export async function deleteFollow(req,res){
    try{
        const target = await getUser(req.params.username);
        if(!target) return res.status(404).json({message: 'User not found'});

        await unfollowUser(req.userId, target.id);
        res.json({following: false});
    }catch (err){
        console.error(err);
        res.status(500).json({message: 'Internal server error'});
    }}