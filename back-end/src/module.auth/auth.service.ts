import {
	forwardRef,
	HttpException,
	HttpStatus, Inject,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import {Request} from 'express';
import {UsersService} from '../module.users/users.service';
import {JwtService} from '@nestjs/jwt';
import {accessToken} from '../dto/payload';
import {UserCredentialService} from './credential.service';
import * as process from "process";
import {UserEntity} from 'src/entities/user.entity';

@Injectable()
export class AuthService {
	constructor(
		@Inject(forwardRef(() => UsersService))
		private readonly usersService: UsersService,
		private jwtService: JwtService,
		private credentialsService: UserCredentialService,
	) {
	}

	/** * * * * * * * * * * * * * * **/

	async logInVisit(login: string, rawPassword: string, token_2fa?: string) {
		if (login === undefined || rawPassword === undefined)
			throw new UnauthorizedException('Login or Password are empty');
		const user = await this.usersService
			.findAll()
			.then((users) => users[users.findIndex((usr) => usr.login == login)]);
		if (!user) {
			throw new UnauthorizedException();
		}
		const credential = await this.usersService.getCredential(user.UserID);
		if (!(await this.credentialsService.compare(rawPassword, credential))) {
			throw new UnauthorizedException();
		}

		const speakeasy = require('speakeasy');
		if (user.has_2fa) {
			if (!token_2fa) throw new HttpException("2FA Token is missing.", HttpStatus.BAD_REQUEST);
			if (!speakeasy.totp.verify({
				secret: credential.token_2fa,
				encoding: 'base32',
				token: token_2fa
			})) throw new HttpException("2FA Invalid.", HttpStatus.BAD_REQUEST);
		}

		const payloadToken: accessToken = {id: user.UserID};
		return await this.jwtService.signAsync(payloadToken);
	}

	async signInVisit(rawPassword: string) {
		const nbVisit = await this.usersService.findAll().then((value) => {
			return value.map(({visit}) => visit).length;
		});
		const login = 'user' + nbVisit;
		const userCredential = await this.credentialsService.create(rawPassword);
		const user = await this.usersService.create(login, true, userCredential);
		const payloadToken: accessToken = {id: user.UserID};
		return await this.jwtService.signAsync(payloadToken);
	}

	/** * * * * * * * * * * * * * * **/

	getIntraURL(req: Request) {
		if (!process.env.PORT_SERVER)
			throw new HttpException('server port error', HttpStatus.BAD_REQUEST);
		const params = {
			client_id: process.env.CLIENT_ID,
			redirect_uri: encodeURIComponent(`${req.protocol}://${req.hostname.replace(process.env.PORT_SERVER, "")}:${process.env.PORT_CLIENT}/callback`),
			response_type: 'code',
		}
		return `https://api.intra.42.fr/oauth/authorize?client_id=${params.client_id}&redirect_uri=${params.redirect_uri}&response_type=${params.response_type}`;
	}

	async connect42(token: string, req: Request, token_2fa: string) {
		const axios = require('axios');

		const tokenRequestData = {
			grant_type: 'authorization_code',
			client_id: process.env.CLIENT_ID,
			client_secret: process.env.CLIENT_SECRET,
			code: token,
			redirect_uri: `${req.protocol}://${req.hostname.replace(process.env.PORT_SERVER, "")}:${process.env.PORT_CLIENT}/callback`,
		};
		let request = await axios.post('https://api.intra.42.fr/oauth/token', tokenRequestData)
			.then(async (response) => {
				if (response.status !== 200)
					throw new HttpException(response.data.error + " / ERROR INTRA TOKEN", response.status);
				const headers = {
					Authorization: `${response.data.token_type} ${response.data.access_token}`,
				}
				try {
					return await axios.get('https://api.intra.42.fr/v2/me', {headers,});
				} catch (error) {
					throw new HttpException(error.message + " / ERROR INTRA TOKEN (/me)", response.status);
				}
			})
			.catch(async (error) => {
				throw new HttpException(error.message + " / ERROR INTRA TOKEN", HttpStatus.UNAUTHORIZED);
			});
		const login = request.data.login;
		const user = await this.usersService
			.findAll()
			.then((users) => users[users.findIndex((usr) => usr.login === login)]);
		// undefined = new user -> sign in
		if (!user) {
			const userCredential = await this.credentialsService.create("");
			let newUser = await this.usersService.create(login, false, userCredential);
			newUser.avatar_path = request.data.image.link ? request.data.image.link : null;
			await newUser.save();
			const payloadToken: accessToken = {id: newUser.UserID};
			return await this.jwtService.signAsync(payloadToken);
		}
		// else log in
		const credential = await this.usersService.getCredential(user.UserID);
		if (!(await this.credentialsService.compare("", credential))) {
			throw new UnauthorizedException();
		}
		const speakeasy = require('speakeasy');
		if (user.has_2fa) {
			if (!token_2fa) throw new HttpException("2FA Token is missing.", HttpStatus.BAD_REQUEST);
			if (!speakeasy.totp.verify({
				secret: credential.token_2fa,
				encoding: 'base32',
				token: token_2fa
			})) throw new HttpException("2FA Invalid.", HttpStatus.BAD_REQUEST);
		}
		const payloadToken: accessToken = {id: user.UserID};
		return await this.jwtService.signAsync(payloadToken);
	}

	/** * * * * * * * * * * * * * * **/

	/**
	 * generate a secret key for 2FA and return the secret and the img
	 * @param user the user to update
	 * @returns {img: string}
	 */
	async generate2FA(user: UserEntity) {
		if (user.has_2fa) throw new HttpException("2fa already enabled.", HttpStatus.BAD_REQUEST)

		const cred = await this.usersService.getCredential(user.UserID);
		const speakeasy = require('speakeasy');
		const secret = speakeasy.generateSecret({length: 20, name: "Pong Pod " + user.UserID});

		cred.token_2fa = secret.base32;
		cred.save();

		return {img: secret.otpauth_url};
	}

	/**
	 * check if the token is valid
	 * @param token the token to check
	 * @param user the user to update if the 2fa is valid
	 * @returns {boolean}
	 */
	async check2FA(token: string, user: UserEntity) {
		const cred = await this.usersService.getCredential(user.UserID);
		if (cred.token_2fa === null) throw new HttpException("No 2fa Generated.", HttpStatus.BAD_REQUEST)

		token = token.substring(0, 6);

		const speakeasy = require('speakeasy');
		if (!speakeasy.totp.verify({
			secret: cred.token_2fa,
			encoding: 'base32',
			token
		})) return false;

		user.has_2fa = true;
		user.save();
		return true;
	}

	/**
	 * disable the 2fa
	 * @param user the user to update
	 * @returns {boolean}
	 */
	async disable2FA(token: string, user: UserEntity) {
		const cred = await this.usersService.getCredential(user.UserID);

		if (!user.has_2fa) throw new HttpException("2fa already disabled.", HttpStatus.BAD_REQUEST)
		if (!cred.token_2fa) throw new HttpException("No 2fa Generated.", HttpStatus.BAD_REQUEST)

		token = token.substring(0, 6);
		const speakeasy = require('speakeasy');

		if (!speakeasy.totp.verify({
			secret: cred.token_2fa,
			encoding: 'base32',
			token
		})) return false;

		cred.token_2fa = null;
		cred.save();
		user.has_2fa = false;
		user.save();

		return true;
	}
}