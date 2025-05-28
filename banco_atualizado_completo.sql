--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9
-- Dumped by pg_dump version 16.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: license_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.license_requests (
    id integer NOT NULL,
    user_id integer NOT NULL,
    transporter_id integer,
    request_number text NOT NULL,
    type text NOT NULL,
    main_vehicle_plate text NOT NULL,
    tractor_unit_id integer,
    first_trailer_id integer,
    dolly_id integer,
    second_trailer_id integer,
    flatbed_id integer,
    length integer NOT NULL,
    additional_plates text[],
    additional_plates_documents text[],
    states text[] NOT NULL,
    status text DEFAULT 'pending_registration'::text NOT NULL,
    state_statuses text[],
    state_files text[],
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    is_draft boolean DEFAULT true NOT NULL,
    comments text,
    license_file_url text DEFAULT ''::text,
    valid_until timestamp without time zone,
    width integer,
    height integer,
    cargo_type text,
    aet_number text,
    state_aet_numbers text[]
);


--
-- Name: license_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.license_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: license_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.license_requests_id_seq OWNED BY public.license_requests.id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


--
-- Name: status_histories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.status_histories (
    id integer NOT NULL,
    license_id integer NOT NULL,
    state text NOT NULL,
    user_id integer NOT NULL,
    old_status text NOT NULL,
    new_status text NOT NULL,
    comments text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: status_histories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.status_histories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: status_histories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.status_histories_id_seq OWNED BY public.status_histories.id;


--
-- Name: transporters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transporters (
    id integer NOT NULL,
    person_type text NOT NULL,
    name text NOT NULL,
    document_number text NOT NULL,
    email text NOT NULL,
    phone text,
    trade_name text,
    legal_responsible text,
    birth_date text,
    nationality text,
    id_number text,
    id_issuer text,
    id_state text,
    street text,
    number text,
    complement text,
    district text,
    zip_code text,
    city text,
    state text,
    subsidiaries json DEFAULT '[]'::json,
    documents json DEFAULT '[]'::json,
    contact1_name text,
    contact1_phone text,
    contact2_name text,
    contact2_phone text,
    user_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: transporters_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transporters_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transporters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transporters_id_seq OWNED BY public.transporters.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    full_name text NOT NULL,
    phone text NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    is_admin boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: vehicle_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_models (
    id integer NOT NULL,
    brand character varying(255) NOT NULL,
    model character varying(255) NOT NULL,
    vehicle_type character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT vehicle_models_vehicle_type_check CHECK (((vehicle_type)::text = ANY ((ARRAY['tractor_unit'::character varying, 'semi_trailer'::character varying, 'trailer'::character varying, 'dolly'::character varying, 'flatbed'::character varying, 'truck'::character varying, 'crane'::character varying])::text[])))
);


--
-- Name: vehicle_models_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vehicle_models_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vehicle_models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vehicle_models_id_seq OWNED BY public.vehicle_models.id;


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicles (
    id integer NOT NULL,
    user_id integer NOT NULL,
    plate text NOT NULL,
    type text NOT NULL,
    brand text,
    model text,
    year integer,
    renavam text,
    tare numeric NOT NULL,
    axle_count integer,
    remarks text,
    crlv_year integer NOT NULL,
    crlv_url text,
    status text DEFAULT 'active'::text NOT NULL,
    body_type text
);


--
-- Name: vehicles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vehicles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vehicles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vehicles_id_seq OWNED BY public.vehicles.id;


--
-- Name: license_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_requests ALTER COLUMN id SET DEFAULT nextval('public.license_requests_id_seq'::regclass);


--
-- Name: status_histories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_histories ALTER COLUMN id SET DEFAULT nextval('public.status_histories_id_seq'::regclass);


--
-- Name: transporters id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transporters ALTER COLUMN id SET DEFAULT nextval('public.transporters_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: vehicle_models id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_models ALTER COLUMN id SET DEFAULT nextval('public.vehicle_models_id_seq'::regclass);


--
-- Name: vehicles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles ALTER COLUMN id SET DEFAULT nextval('public.vehicles_id_seq'::regclass);


--
-- Data for Name: license_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.license_requests (id, user_id, transporter_id, request_number, type, main_vehicle_plate, tractor_unit_id, first_trailer_id, dolly_id, second_trailer_id, flatbed_id, length, additional_plates, additional_plates_documents, states, status, state_statuses, state_files, created_at, updated_at, is_draft, comments, license_file_url, valid_until, width, height, cargo_type, aet_number, state_aet_numbers) FROM stdin;
63	2	1	AET-2025-5473	bitrain_9_axles	ABC1234	1	10	\N	10	\N	2500	{}	{}	{SP,DNIT}	approved	{SP:approved:2025-06-26,DNIT:approved:2025-05-31}	{SP:/uploads/stateFile-1747250644155-396345035.pdf,DNIT:/uploads/stateFile-1747258222757-233312162.pdf}	2025-05-14 19:23:38.163	2025-05-14 21:30:23.111	f		/uploads/stateFile-1747258222757-233312162.pdf	2025-05-31 00:00:00	260	440	dry_cargo	434343	{SP:434343,DNIT:434343}
91	1	1	AET-2025-4539	bitrain_9_axles	ABC1234	1	23	\N	18	\N	1980	{}	{}	{MS}	pending_registration	{}	{}	2025-05-16 14:33:21.023	2025-05-16 14:33:21.023	f		\N	\N	260	440	dry_cargo	\N	\N
90	1	1	AET-2025-8550	bitrain_9_axles	ABC1234	1	10	\N	10	\N	2500	{}	{}	{SP}	pending_registration	{}	{}	2025-05-16 14:04:54.196	2025-05-16 14:05:09.811	f	Renovação da licença AET-2025-5473 para o estado SP	\N	\N	260	440	dry_cargo	\N	\N
92	1	1	AET-2025-7877	bitrain_9_axles	ABC1234	1	10	\N	10	\N	2500	{}	{}	{SP}	pending_registration	{}	{}	2025-05-16 14:33:44.236	2025-05-16 14:33:54.661	f	Renovação da licença AET-2025-5473 para o estado SP	\N	\N	260	440	dry_cargo	\N	\N
88	1	2	AET-2025-6604	bitrain_9_axles	ABC1234	1	18	\N	19	\N	2500	{}	{}	{SC}	pending_registration	{SC:registration_in_progress}	{}	2025-05-15 22:15:48.027	2025-05-16 20:01:50.959	f		\N	\N	260	440	liquid_cargo	\N	{}
93	1	1	AET-2025-7549	bitrain_9_axles	ABC1234	1	10	\N	10	\N	2500	{}	{}	{PE,MT,PA}	pending_registration	{}	{}	2025-05-16 14:34:33.034	2025-05-16 14:34:43.298	f	Renovação da licença AET-2025-5473 para o estado SP	\N	\N	260	440	dry_cargo	\N	\N
94	1	2	AET-2025-8861	bitrain_6_axles	REQ3252	31	17	\N	19	\N	1980	{}	{}	{MG,RS}	pending_registration	{}	{}	2025-05-16 15:41:32.249	2025-05-16 15:41:32.249	f		\N	\N	260	440	liquid_cargo	\N	\N
97	1	1	AET-2025-8997	bitrain_9_axles	REQ3252	31	18	\N	17	\N	1980	{}	{}	{SC,DF}	pending_registration	{}	{}	2025-05-16 17:33:48.879	2025-05-16 17:33:48.879	f		\N	\N	3	4	liquid_cargo	\N	\N
98	1	2	AET-2025-2954	bitrain_9_axles	REQ3252	31	18	\N	19	\N	2500	{}	{}	{SC,DF}	pending_registration	{SC:registration_in_progress}	{}	2025-05-16 17:59:08.423	2025-05-16 20:02:27.249	f		\N	\N	260	440	liquid_cargo	\N	{}
96	1	1	AET-2025-4864	bitrain_9_axles	ABC1234	1	10	\N	10	\N	2500	{}	{}	{SP}	pending_registration	{}	{}	2025-05-16 17:30:56.087	2025-05-16 18:01:12.692	f	Renovação da licença AET-2025-5473 para o estado SP	\N	\N	260	440	dry_cargo	\N	\N
100	1	1	AET-2025-3948	bitrain_7_axles	REQ3252	31	10	\N	10	32	1980	{}	{}	{BA,RS}	pending_registration	{BA:registration_in_progress,RS:rejected}	{}	2025-05-16 18:33:48.446	2025-05-16 19:54:28.508	f		\N	\N	260	440	liquid_cargo	\N	{}
103	1	1	AET-2025-1869	bitrain_9_axles	ABC1234	1	10	\N	10	\N	2500	{}	{}	{SP}	pending_registration	{SP:rejected}	{}	2025-05-16 19:48:57.508	2025-05-16 20:02:37.786	f	Renovação da licença AET-2025-5473 para o estado SP	\N	\N	260	440	dry_cargo	\N	{}
99	1	2	AET-2025-8197	bitrain_9_axles	REQ3252	31	16	\N	20	\N	2500	{}	{}	{BA,PA}	pending_registration	{BA:under_review,PA:rejected}	{}	2025-05-16 18:28:15.61	2025-05-16 19:56:24.036	f		\N	\N	260	440	liquid_cargo	efsdfsdf	{BA:efsdfsdf}
105	1	1	AET-2025-6099	bitrain_9_axles	ABC1234	1	10	\N	10	\N	2500	{}	{}	{SP}	pending_registration	{}	{}	2025-05-16 20:36:24.085	2025-05-16 20:36:40.102	f	Renovação da licença AET-2025-5473 para o estado SP	\N	\N	260	440	dry_cargo	\N	\N
104	1	1	AET-2025-8573	bitrain_9_axles	ABC1234	1	10	\N	10	\N	2500	{SDF9653}	{""}	{SP,DF,SC}	pending_registration	{}	{}	2025-05-16 20:12:16.127	2025-05-16 20:36:15.205	f	Renovação da licença AET-2025-5473 para o estado SP	\N	\N	260	440	liquid_cargo	\N	\N
106	2	1	AET-2025-7886	bitrain_9_axles	ABC1234	1	10	\N	10	\N	2500	{}	{}	{SP}	pending_registration	{}	{}	2025-05-16 21:46:19.356	2025-05-16 21:54:07.461	f	Renovação da licença AET-2025-5473 para o estado SP	\N	\N	260	440	dry_cargo	\N	\N
107	2	1	AET-2025-1857	bitrain_9_axles	ABC1234	1	10	\N	10	\N	2500	{}	{}	{SP,TO,PA}	pending_registration	{SP:registration_in_progress,TO:rejected,PA:approved:2025-07-17}	{PA:/uploads/stateFile-1747433498572-29221828.pdf}	2025-05-16 21:47:07.906	2025-05-16 22:11:38.87	f	Renovação da licença AET-2025-5473 para o estado SP	/uploads/stateFile-1747433498572-29221828.pdf	2025-07-17 00:00:00	260	440	liquid_cargo	12312	{PA:12312}
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.session (sid, sess, expire) FROM stdin;
1NPWqCrU0oXCmAnHm21uQ-W6Q02uxf4D	{"cookie":{"originalMaxAge":86400000,"expires":"2025-05-29T02:47:46.416Z","secure":false,"httpOnly":true,"path":"/"},"passport":{"user":1}}	2025-05-29 02:50:01
Ve14tW7fhDLyGhnhwS6jpI5xZj1mPOaw	{"cookie":{"originalMaxAge":86400000,"expires":"2025-05-29T16:28:52.076Z","secure":false,"httpOnly":true,"path":"/"},"passport":{"user":8}}	2025-05-29 16:45:53
\.


--
-- Data for Name: status_histories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.status_histories (id, license_id, state, user_id, old_status, new_status, comments, created_at) FROM stdin;
15	63	SP	1	pending	approved	\N	2025-05-14 19:24:04.799
16	63	DNIT	1	pending	approved	\N	2025-05-14 21:30:23.137
20	100	BA	1	pending	registration_in_progress	\N	2025-05-16 19:54:22.153
21	100	RS	1	pending	rejected	\N	2025-05-16 19:54:28.53
22	103	SP	1	pending	registration_in_progress	\N	2025-05-16 19:55:52.252
23	99	BA	1	pending	under_review	\N	2025-05-16 19:56:16.7
24	99	PA	1	pending	rejected	aasadsa	2025-05-16 19:56:24.058
25	88	SC	1	pending	registration_in_progress	\N	2025-05-16 20:01:50.98
26	98	SC	1	pending	registration_in_progress	\N	2025-05-16 20:02:27.31
27	103	SP	1	registration_in_progress	rejected	\N	2025-05-16 20:02:37.81
28	107	SP	1	pending	registration_in_progress	\N	2025-05-16 22:09:41.854
29	107	TO	1	pending	rejected	sazzsfczsc	2025-05-16 22:09:49.461
30	107	PA	1	pending	pending_approval	asdas	2025-05-16 22:10:02.996
31	107	PA	1	pending_approval	approved	\N	2025-05-16 22:11:38.894
\.


--
-- Data for Name: transporters; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transporters (id, person_type, name, document_number, email, phone, trade_name, legal_responsible, birth_date, nationality, id_number, id_issuer, id_state, street, number, complement, district, zip_code, city, state, subsidiaries, documents, contact1_name, contact1_phone, contact2_name, contact2_phone, user_id, created_at) FROM stdin;
1	pj	Transportadora Teste Ltda	12345678000190	contato@transportesteste.com	(11) 3333-4444	Transportes Rápidos	João da Silva	\N	\N	\N	\N	\N	Avenida Brasil	1500	Sala 300	Centro	01000-000	São Paulo	SP	[]	[]	\N	\N	\N	\N	2	2025-04-15 11:38:34.318878
2	pj	FRIBON TRANSPORTES LTDA	10280806000134	teste@teste.com	(11) 98765-4321	FRIBON TRANSPORTES	tedtyr	\N	\N	\N	\N	\N	RODOVIA BR-364	SN	SETOR AREAS PERIFERICAS	VILA RICA	78750541	RONDONOPOLIS	MT	"[]"	"[]"	tedtyr	(11) 98765-4321			3	2025-04-25 15:08:52.386275
4	pj	TRANSPORTADORA NOSSA SENHORA DE CARAVAGGIO LTDA EM RECUPERACAO JUDICIAL	81718751000140	fiscal@nscaravaggio.com.br	(11) 98765-4321		Junior	\N	\N	\N	\N	\N	R GUSTAVO KABITSCHKE	628		RIO VERDE	83405000	COLOMBO	PR	"[]"	"[]"	Junior	(11) 98765-4321			8	2025-05-28 01:41:43.075108
5	pj	LIMESTONE BRASIL MINERACAO LTDA	08916636000190	teste2@teste.com	119995605606		Marcio	\N	\N	\N	\N	\N	ESTRADA DO CAPIRUZINHO	220		CAPIRUZINHO	83540000	RIO BRANCO DO SUL	PR	"[]"	"[]"	Marcio	119995605606			\N	2025-05-28 19:28:05.778335
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, password, full_name, phone, role, is_admin, created_at) FROM stdin;
2	transportador@teste.com	$2b$10$oDIUQbw08yuv3aX/uAHWoO8BDC5h3l24giiPDZ.iWoKKwS3.AvbW6	Usuário Transportador	(11) 98765-4321	user	f	2025-04-15 11:38:27.347289
3	teste@teste.com	a0c7112b086781e7f6da2132f1894d5a2c0d102d60019471770d23ae96600e8367f6f6af5d98c9b2be48c1a5e2a7c41839d925e3ac8eb60f43574fa26ac01611.da70f8841797ba74f193344c672f59d3	Joao teste	(11) 98765-4321	user	f	2025-04-25 20:04:49.800048
5	operacional02@sistema.com	d11772c10b7d1899bb561bd48eaf70f7141b9511319013e08e4d527424c69eda48d23f9c92c547d22e619574d700db29666e9e3e3c4cb7d4f85ff083790ed0c6.3b26b146b5e74c61d16b8399035341f0	Operacional 02		operational	f	2025-04-29 21:12:57.020241
6	supervisor@sistema.com	cd36b8a5fd25922fa34849e1226af7784eefa3f43e4e91b4152d204efcdc08bb0203e8de5227187d79add6543c3fd3fdc3aab8e02b73b523e6c00fd09f3c63b7.faf6873ce97527103f6ab253b72fa815	Supervidor		supervisor	f	2025-04-29 21:14:14.899044
4	operacional01@sistema.com	fe43e5022793369fb3c068a44af36b65349350fcce4c5d62e2277939a8959569a9853ce43010fae682a8a6498bc933d0d0456170421c7f644cfd87fa42fa5efb.179440800aadbb5811cff92c4712d126	Operacional 01		operational	f	2025-04-29 21:11:56.061599
1	admin@sistema.com	admin123	Administrador	(11) 99999-9999	admin	t	2025-04-15 11:38:27.347289
8	fiscal@nscaravaggio.com.br	91ca910e3b91e0693832dbf52f4d0dce4e314266398cf526f30fea97daf7260a50dc591ba9ab40672615c45d71b92533c6cc10f77b89529532719567c5756972.f13dab3771da4f4b078dba8b3cb8ab57	Usuário Transportador	41999193321	user	f	2025-05-28 16:28:38.793836
9	teste2@teste.com	7ac4bb440e96e85bee319127df787afde7e6689852e5f3d7c141f1229750e3038db8d9a50de8a53c89e770905176f588a07fd59bb2bc911426ca558772af1f0e.3617b907a9e9b1024680e9370ca3bdb8	tste5	41999193321	user	f	2025-05-28 19:28:36.555657
\.


--
-- Data for Name: vehicle_models; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vehicle_models (id, brand, model, vehicle_type, created_at) FROM stdin;
1	DAF	CF FT 410	tractor_unit	2025-05-27 14:04:59.586528
2	FORD	CARGO 1621	truck	2025-05-27 14:05:29.312799
3	DAF	CF FT 410	tractor_unit	2025-05-27 14:18:09.323768
4	DAF	CF85 FT 410A	tractor_unit	2025-05-27 14:18:09.323768
5	DAF	XF FT 480	tractor_unit	2025-05-27 14:18:09.323768
6	DAF	XF FT 480 SSC	tractor_unit	2025-05-27 14:18:09.323768
7	DAF	XF FT 530	tractor_unit	2025-05-27 14:18:09.323768
8	DAF	XF FTS 480	tractor_unit	2025-05-27 14:18:09.323768
9	DAF	XF FTS 530 SSC	tractor_unit	2025-05-27 14:18:09.323768
10	DAF	XF FTT 480	tractor_unit	2025-05-27 14:18:09.323768
11	DAF	XF FTT 530	tractor_unit	2025-05-27 14:18:09.323768
12	DAF	XF FTT 530 SSC	tractor_unit	2025-05-27 14:18:09.323768
13	DAF	XF105 FTS 460A	tractor_unit	2025-05-27 14:18:09.323768
14	DAF	XF105 FTT 460A	tractor_unit	2025-05-27 14:18:09.323768
15	DAF	XF105 FTT 510A	tractor_unit	2025-05-27 14:18:09.323768
16	FORD	CARGO 1621	tractor_unit	2025-05-27 14:18:09.323768
17	FORD	CARGO 1622	tractor_unit	2025-05-27 14:18:09.323768
18	FORD	CARGO 2042 AT	tractor_unit	2025-05-27 14:18:09.323768
19	FORD	CARGO 2425	tractor_unit	2025-05-27 14:18:09.323768
20	FORD	CARGO 2428 CNL	tractor_unit	2025-05-27 14:18:09.323768
21	FORD	CARGO 2428 E	tractor_unit	2025-05-27 14:18:09.323768
22	FORD	CARGO 2428E	tractor_unit	2025-05-27 14:18:09.323768
23	FORD	CARGO 2429L	tractor_unit	2025-05-27 14:18:09.323768
24	FORD	CARGO 2431 l	tractor_unit	2025-05-27 14:18:09.323768
25	FORD	CARGO 2629 6X4	tractor_unit	2025-05-27 14:18:09.323768
26	FORD	CARGO 2842 AT	tractor_unit	2025-05-27 14:18:09.323768
27	FORD	CARGO 2932 E	tractor_unit	2025-05-27 14:18:09.323768
28	FORD	CARGO 4331	tractor_unit	2025-05-27 14:18:09.323768
29	FORD	CARGO 4532 E	tractor_unit	2025-05-27 14:18:09.323768
30	FORD	CARGO 4532E TOPLINE	tractor_unit	2025-05-27 14:18:09.323768
31	FORD	CARGO 6332E	tractor_unit	2025-05-27 14:18:09.323768
32	FORD	CHAPEMEC CARGO	tractor_unit	2025-05-27 14:18:09.323768
33	FORD	F14000	tractor_unit	2025-05-27 14:18:30.800885
34	I/MO	GROVE GMK5250L	crane	2025-05-27 14:18:30.800885
35	I/MO	XCMG QY 70K -I	crane	2025-05-27 14:18:30.800885
36	IMO XCMG	QY 50K	crane	2025-05-27 14:18:30.800885
37	INTERNACIONAL	9800P7 6X4	tractor_unit	2025-05-27 14:18:30.800885
38	INTERNATIONAL	9800 4X2	tractor_unit	2025-05-27 14:18:30.800885
39	INTERNATIONAL	9800 6X4	tractor_unit	2025-05-27 14:18:30.800885
40	INTERNATIONAL	9800I 6X2	tractor_unit	2025-05-27 14:18:30.800885
41	INTERNATIONAL	9800I 6X4	tractor_unit	2025-05-27 14:18:30.800885
42	IVECO	EUROTECH 450E37TN1	tractor_unit	2025-05-27 14:18:30.800885
43	IVECO	CAVALLINO 450E32T	tractor_unit	2025-05-27 14:18:30.800885
44	IVECO	CURSOR 450E32T	tractor_unit	2025-05-27 14:18:30.800885
45	IVECO	CURSOR 450E33T	tractor_unit	2025-05-27 14:18:30.800885
46	IVECO	ECCURSOR 450E32TN	tractor_unit	2025-05-27 14:18:30.800885
47	IVECO	FIAT E 450E3HT	tractor_unit	2025-05-27 14:18:30.800885
48	IVECO	STRALIHD 450S38TN1	tractor_unit	2025-05-27 14:18:30.800885
49	IVECO	STRALIHD 490S38TN1	tractor_unit	2025-05-27 14:18:30.800885
50	IVECO	STRALIHD 570S38TN1	tractor_unit	2025-05-27 14:18:30.800885
51	IVECO	STRALIHD 570S42TN1	tractor_unit	2025-05-27 14:18:30.800885
52	IVECO	STRALIHD 740S42TZN	tractor_unit	2025-05-27 14:18:30.800885
53	IVECO	STRALIHD 740S46TZ	tractor_unit	2025-05-27 14:18:30.800885
54	IVECO	STRALIS 450S33T	tractor_unit	2025-05-27 14:18:30.800885
55	IVECO	STRALIS 460S36T	tractor_unit	2025-05-27 14:18:30.800885
56	IVECO	STRALIS 490S38T	tractor_unit	2025-05-27 14:18:30.800885
57	IVECO	STRALIS 490S40T	tractor_unit	2025-05-27 14:18:30.800885
58	IVECO	STRALIS 490S41T	tractor_unit	2025-05-27 14:18:30.800885
59	IVECO	STRALIS 490S44T	tractor_unit	2025-05-27 14:18:30.800885
60	IVECO	STRALIS 490S46T	tractor_unit	2025-05-27 14:18:30.800885
61	IVECO	STRALIS 490S48T	tractor_unit	2025-05-27 14:18:30.800885
62	IVECO	STRALIS 800S56TZ	tractor_unit	2025-05-27 14:18:30.800885
63	DAF	CF FT 410	tractor_unit	2025-05-27 14:19:08.956815
64	DAF	CF85 FT 410A	tractor_unit	2025-05-27 14:19:08.980571
65	DAF	XF FT 480	tractor_unit	2025-05-27 14:19:08.9959
66	DAF	XF FT 480 SSC	tractor_unit	2025-05-27 14:19:09.011271
67	DAF	XF FT 530	tractor_unit	2025-05-27 14:19:09.026588
68	DAF	XF FTS 480	tractor_unit	2025-05-27 14:19:09.041836
69	DAF	XF FTS 530 SSC	tractor_unit	2025-05-27 14:19:09.058464
70	DAF	XF FTT 480	tractor_unit	2025-05-27 14:19:09.073618
71	DAF	XF FTT 530	tractor_unit	2025-05-27 14:19:09.088778
72	DAF	XF FTT 530 SSC	tractor_unit	2025-05-27 14:19:09.103985
73	DAF	XF105 FTS 460A	tractor_unit	2025-05-27 14:19:09.120549
74	DAF	XF105 FTT 460A	tractor_unit	2025-05-27 14:19:09.140356
75	DAF	XF105 FTT 510A	tractor_unit	2025-05-27 14:19:09.158695
76	FORD	CARGO 1621	tractor_unit	2025-05-27 14:19:09.174321
77	FORD	CARGO 1622	tractor_unit	2025-05-27 14:19:09.189379
78	FORD	CARGO 2042 AT	tractor_unit	2025-05-27 14:19:09.20459
79	FORD	CARGO 2425	tractor_unit	2025-05-27 14:19:09.219865
80	FORD	CARGO 2428 CNL	tractor_unit	2025-05-27 14:19:09.235111
81	FORD	CARGO 2428 E	tractor_unit	2025-05-27 14:19:09.250538
82	FORD	CARGO 2428E	tractor_unit	2025-05-27 14:19:09.265579
83	FORD	CARGO 2429L	tractor_unit	2025-05-27 14:19:09.281699
84	FORD	CARGO 2431 l	tractor_unit	2025-05-27 14:19:09.296837
85	FORD	CARGO 2629 6X4	tractor_unit	2025-05-27 14:19:09.312223
86	FORD	CARGO 2842 AT	tractor_unit	2025-05-27 14:19:09.327525
87	FORD	CARGO 2932 E	tractor_unit	2025-05-27 14:19:09.342745
88	FORD	CARGO 4331	tractor_unit	2025-05-27 14:19:09.35775
89	FORD	CARGO 4532 E	tractor_unit	2025-05-27 14:19:09.373042
90	FORD	CARGO 4532E TOPLINE	tractor_unit	2025-05-27 14:19:09.388325
91	FORD	CARGO 6332E	tractor_unit	2025-05-27 14:19:09.403421
92	FORD	CHAPEMEC CARGO	tractor_unit	2025-05-27 14:19:09.418917
93	FORD	F14000	tractor_unit	2025-05-27 14:19:09.434212
94	I/MO	GROVE GMK5250L	crane	2025-05-27 14:19:09.449819
95	I/MO	XCMG QY 70K -I	crane	2025-05-27 14:19:09.4657
96	IMO XCMG	QY 50K	crane	2025-05-27 14:19:09.480945
97	INTERNACIONAL	9800P7 6X4	tractor_unit	2025-05-27 14:19:09.496987
98	INTERNATIONAL	9800 4X2	tractor_unit	2025-05-27 14:19:09.512259
99	INTERNATIONAL	9800 6X4	tractor_unit	2025-05-27 14:19:09.527731
100	INTERNATIONAL	9800I 6X2	tractor_unit	2025-05-27 14:19:09.542865
101	INTERNATIONAL	9800I 6X4	tractor_unit	2025-05-27 14:19:09.558826
102	IVECO	EUROTECH 450E37TN1	tractor_unit	2025-05-27 14:19:09.582075
103	IVECO	CAVALLINO 450E32T	tractor_unit	2025-05-27 14:19:09.598534
104	IVECO	CURSOR 450E32T	tractor_unit	2025-05-27 14:19:09.614709
105	IVECO	CURSOR 450E33T	tractor_unit	2025-05-27 14:19:09.630406
106	IVECO	ECCURSOR 450E32TN	tractor_unit	2025-05-27 14:19:09.645523
107	IVECO	FIAT E 450E3HT	tractor_unit	2025-05-27 14:19:09.660574
108	IVECO	STRALIHD 450S38TN1	tractor_unit	2025-05-27 14:19:09.67643
109	IVECO	STRALIHD 490S38TN1	tractor_unit	2025-05-27 14:19:09.695571
110	IVECO	STRALIHD 570S38TN1	tractor_unit	2025-05-27 14:19:09.710877
111	IVECO	STRALIHD 570S42TN1	tractor_unit	2025-05-27 14:19:09.727957
112	IVECO	STRALIHD 740S42TZN	tractor_unit	2025-05-27 14:19:09.743342
113	IVECO	STRALIHD 740S46TZ	tractor_unit	2025-05-27 14:19:09.75849
114	IVECO	STRALIS 450S33T	tractor_unit	2025-05-27 14:19:09.773648
115	IVECO	STRALIS 460S36T	tractor_unit	2025-05-27 14:19:09.789582
116	IVECO	STRALIS 490S38T	tractor_unit	2025-05-27 14:19:09.804887
117	IVECO	STRALIS 490S40T	tractor_unit	2025-05-27 14:19:09.820093
118	IVECO	STRALIS 490S41T	tractor_unit	2025-05-27 14:19:09.835112
119	IVECO	STRALIS 490S44T	tractor_unit	2025-05-27 14:19:09.850192
120	IVECO	STRALIS 490S46T	tractor_unit	2025-05-27 14:19:09.865696
121	IVECO	STRALIS 490S48T	tractor_unit	2025-05-27 14:19:09.881029
122	IVECO	STRALIS 800S56TZ	tractor_unit	2025-05-27 14:19:09.896095
123	IVECO	STRALISHD 450S38T	tractor_unit	2025-05-27 14:19:09.911202
124	IVECO	STRALISHD 450S38TN	tractor_unit	2025-05-27 14:19:09.927118
125	IVECO	STRALISHD 490S38TN	tractor_unit	2025-05-27 14:19:09.942425
126	IVECO	STRALISHD 490S46T	tractor_unit	2025-05-27 14:19:09.957727
127	IVECO	STRALISHD 570S38TN	tractor_unit	2025-05-27 14:19:09.97369
128	IVECO	STRALISHD 570S42TN	tractor_unit	2025-05-27 14:19:09.989055
129	IVECO	S-WAY 480-4X2	tractor_unit	2025-05-27 14:19:10.005155
130	IVECO	S-WAY 480-6X2	tractor_unit	2025-05-27 14:19:10.02061
131	IVECO	S-WAY 540-6X4	tractor_unit	2025-05-27 14:19:10.035696
132	IVECO	TECTOR 240E28	tractor_unit	2025-05-27 14:19:10.050908
133	IVECO	TECTOR 310E30CE	tractor_unit	2025-05-27 14:19:10.066117
134	IVECO	TRAKKER 380T42N	tractor_unit	2025-05-27 14:19:10.081305
135	IVECO	TRAKKER 410T48	tractor_unit	2025-05-27 14:19:10.097894
136	IVECO	TRAKKER 480T42N	tractor_unit	2025-05-27 14:19:10.113028
137	IVECO	TRAKKER 720T42TN	tractor_unit	2025-05-27 14:19:10.128249
138	IVECO	TRAKKER 740T48T	tractor_unit	2025-05-27 14:19:10.14365
139	IVECO	STRALIS HD 740S42TZ	tractor_unit	2025-05-27 14:19:10.15931
140	IVECO	RURAL COTTON TRANSP E CORRETAGEM AGRIC L	tractor_unit	2025-05-27 14:19:10.174615
141	M.BENZ	L 2638	tractor_unit	2025-05-27 14:19:10.189737
142	M.BENZ	ATEGO 2730 CE	tractor_unit	2025-05-27 14:19:10.204967
143	M.BENZ	ACTROS 2045S	tractor_unit	2025-05-27 14:19:10.220344
144	M.BENZ	ACTROS 2651LS6X4	tractor_unit	2025-05-27 14:19:10.235614
145	M.BENZ	ACTROS 2651S6X4	tractor_unit	2025-05-27 14:19:10.250916
146	M.BENZ	ACTROS2646LS6X4	tractor_unit	2025-05-27 14:19:10.266065
147	M.BENZ	ATEGO 2425	tractor_unit	2025-05-27 14:19:10.281549
148	M.BENZ	AXOR 1933 S	tractor_unit	2025-05-27 14:19:10.2969
149	M.BENZ	AXOR 2040 S	tractor_unit	2025-05-27 14:19:10.312021
150	M.BENZ	AXOR 2041 LS	tractor_unit	2025-05-27 14:19:10.327449
151	M.BENZ	AXOR 2535 S	tractor_unit	2025-05-27 14:19:10.342644
152	M.BENZ	AXOR 2544 S	tractor_unit	2025-05-27 14:19:10.357797
153	M.BENZ	AXOR 2644 LS 6X4	tractor_unit	2025-05-27 14:19:10.372909
154	M.BENZ	AXOR 2644S6X4	tractor_unit	2025-05-27 14:19:10.388377
155	M.BENZ	AXOR 33446X4	tractor_unit	2025-05-27 14:19:10.40385
156	M.BENZ	AXOR 3344S6X4	tractor_unit	2025-05-27 14:19:10.419056
157	M.BENZ	2418	tractor_unit	2025-05-27 14:19:10.434149
158	M.BENZ	1728 TRUKAM CA	tractor_unit	2025-05-27 14:19:10.449275
159	M.BENZ	1938 S	tractor_unit	2025-05-27 14:19:10.46458
160	M.BENZ	1944 S	tractor_unit	2025-05-27 14:19:10.479785
161	M.BENZ	2038 S	tractor_unit	2025-05-27 14:19:10.495099
162	M.BENZ	2423 K	tractor_unit	2025-05-27 14:19:10.510851
163	M.BENZ	2726 6X4	tractor_unit	2025-05-27 14:19:10.526567
164	M.BENZ	ACCELO 815 CE	tractor_unit	2025-05-27 14:19:10.542343
165	M.BENZ	ACTROS 2546LS	tractor_unit	2025-05-27 14:19:10.557358
166	M.BENZ	ACTROS 2548S	tractor_unit	2025-05-27 14:19:10.572516
167	M.BENZ	ACTROS 2553S	tractor_unit	2025-05-27 14:19:10.587811
168	M.BENZ	ACTROS 2646LS6X4	tractor_unit	2025-05-27 14:19:10.603393
169	M.BENZ	ACTROS 2646S6X4	tractor_unit	2025-05-27 14:19:10.618856
170	M.BENZ	ACTROS 2648S 6X4	tractor_unit	2025-05-27 14:19:10.634058
171	M.BENZ	ACTROS 2651S 6X4	tractor_unit	2025-05-27 14:19:10.64914
172	M.BENZ	ACTROS 2653S	tractor_unit	2025-05-27 14:19:10.664131
173	M.BENZ	ATEGO 1726	tractor_unit	2025-05-27 14:19:10.67926
174	M.BENZ	ATEGO 1726 CE	tractor_unit	2025-05-27 14:19:10.69481
175	M.BENZ	ATEGO 2426	tractor_unit	2025-05-27 14:19:10.710146
176	M.BENZ	ATEGO 2428	tractor_unit	2025-05-27 14:19:10.725335
177	M.BENZ	ATEGO 2429	tractor_unit	2025-05-27 14:19:10.74264
178	M.BENZ	ATEGO 2730 6X4 CE	tractor_unit	2025-05-27 14:19:10.757839
179	M.BENZ	ATEGO 2730 6X4 CL	tractor_unit	2025-05-27 14:19:10.772925
180	M.BENZ	ATEGO 2730CE	tractor_unit	2025-05-27 14:19:10.788027
181	M.BENZ	ATEGO 3030 CE	tractor_unit	2025-05-27 14:19:10.803476
182	M.BENZ	ATEGO 3033CE	tractor_unit	2025-05-27 14:19:10.818469
183	M.BENZ	ATEGO 3330	tractor_unit	2025-05-27 14:19:10.833638
184	M.BENZ	ATRON 1635 S	tractor_unit	2025-05-27 14:19:10.849632
185	M.BENZ	ATRON 2729 6X4	tractor_unit	2025-05-27 14:19:10.864701
186	M.BENZ	AXOR 1933	tractor_unit	2025-05-27 14:19:10.880227
187	M.BENZ	AXOR 1933 GNG S	tractor_unit	2025-05-27 14:19:10.895708
188	M.BENZ	AXOR 2035 S	tractor_unit	2025-05-27 14:19:10.912458
189	M.BENZ	AXOR 2036 S	tractor_unit	2025-05-27 14:19:10.927646
190	M.BENZ	AXOR 2040	tractor_unit	2025-05-27 14:19:10.943622
191	M.BENZ	AXOR 2041 S	tractor_unit	2025-05-27 14:19:10.959474
192	M.BENZ	AXOR 2044 S	tractor_unit	2025-05-27 14:19:10.97457
193	M.BENZ	AXOR 2533	tractor_unit	2025-05-27 14:19:10.9901
194	M.BENZ	AXOR 2536 LS	tractor_unit	2025-05-27 14:19:11.005894
195	M.BENZ	AXOR 2540 S	tractor_unit	2025-05-27 14:19:11.021229
196	M.BENZ	AXOR 2541 S	tractor_unit	2025-05-27 14:19:11.036848
197	M.BENZ	AXOR 2544S ASTER	tractor_unit	2025-05-27 14:19:11.052703
198	M.BENZ	AXOR 2641S6X4	tractor_unit	2025-05-27 14:19:11.068399
199	M.BENZ	AXOR 28316X4	tractor_unit	2025-05-27 14:19:11.083812
200	M.BENZ	AXOR 3131 6X4	tractor_unit	2025-05-27 14:19:11.099083
201	M.BENZ	AXOR 33406X4	tractor_unit	2025-05-27 14:19:11.114959
202	M.BENZ	AXOR 3340S6X4	tractor_unit	2025-05-27 14:19:11.13085
203	M.BENZ	AXOR LOC TRATOR	tractor_unit	2025-05-27 14:19:11.146056
204	M.BENZ	L 1620	tractor_unit	2025-05-27 14:19:11.161469
205	M.BENZ	L 1621	tractor_unit	2025-05-27 14:19:11.177014
206	M.BENZ	L 2220	tractor_unit	2025-05-27 14:19:11.192505
207	M.BENZ	LK 2318	tractor_unit	2025-05-27 14:19:11.207808
208	M.BENZ	LS 1634	tractor_unit	2025-05-27 14:19:11.222928
209	M.BENZ	LS 1935	tractor_unit	2025-05-27 14:19:11.238707
210	M.BENZ	LS 1941	tractor_unit	2025-05-27 14:19:11.253914
211	M.BENZ	LS 2638	tractor_unit	2025-05-27 14:19:11.269104
212	M.BENZ	LUCIANE	tractor_unit	2025-05-27 14:19:11.284299
213	MAN	TGX 28.440 6X2 T	tractor_unit	2025-05-27 14:19:11.299874
214	MAN	TGX 29.440 6X4 T	tractor_unit	2025-05-27 14:19:11.315315
215	MAN	TGX 29.480 6X4 T	tractor_unit	2025-05-27 14:19:11.331313
216	MAN	TGX 33.440 6X4 T	tractor_unit	2025-05-27 14:19:11.346528
217	MERCEDES-BENZ	ACTROS 2651S	tractor_unit	2025-05-27 14:19:11.361623
218	NAVISTAR	INTERN 9800 6X4	tractor_unit	2025-05-27 14:19:11.376724
219	SCANIA	G 360 A4X2	tractor_unit	2025-05-27 14:19:11.393304
220	SCANIA	G 380 A4x2	tractor_unit	2025-05-27 14:19:11.409229
221	SCANIA	G 380 A6X2	tractor_unit	2025-05-27 14:19:11.424884
222	SCANIA	G 400 A4X2	tractor_unit	2025-05-27 14:19:11.440109
223	SCANIA	G 400 A6X2	tractor_unit	2025-05-27 14:19:11.455922
224	SCANIA	G 420 A4X2	tractor_unit	2025-05-27 14:19:11.471465
225	SCANIA	G 420 A6X2	tractor_unit	2025-05-27 14:19:11.486539
226	SCANIA	G 420 A6X4	tractor_unit	2025-05-27 14:19:11.501634
227	SCANIA	G 420 B6X4	tractor_unit	2025-05-27 14:19:11.517049
228	SCANIA	G 440 A6X4	tractor_unit	2025-05-27 14:19:11.532408
229	SCANIA	G 440 A6X4 CS	tractor_unit	2025-05-27 14:19:11.547955
230	SCANIA	G 440 B6X4 CS	tractor_unit	2025-05-27 14:19:11.563104
231	SCANIA	G 470 A6X4	tractor_unit	2025-05-27 14:19:11.578288
232	SCANIA	G 480 A6X4	tractor_unit	2025-05-27 14:19:11.59375
233	SCANIA	G 480 A6X4 CS	tractor_unit	2025-05-27 14:19:11.609099
234	SCANIA	G370 A4X2	tractor_unit	2025-05-27 14:19:11.6242
235	SCANIA	G370 A6X2	tractor_unit	2025-05-27 14:19:11.639385
236	SCANIA	G410 A4X2	tractor_unit	2025-05-27 14:19:11.654413
237	SCANIA	G410 A6X2	tractor_unit	2025-05-27 14:19:11.669972
238	SCANIA	G420 A6X2	tractor_unit	2025-05-27 14:19:11.685321
239	SCANIA	G450 A6X4 XT	tractor_unit	2025-05-27 14:19:11.701246
240	SCANIA	G540 A6X4 XT CS	tractor_unit	2025-05-27 14:19:11.717145
241	SCANIA	G560 A6X4 XT	tractor_unit	2025-05-27 14:19:11.732949
242	SCANIA	L111	tractor_unit	2025-05-27 14:19:11.748198
243	SCANIA	LK 111	tractor_unit	2025-05-27 14:19:11.764138
244	SCANIA	P 250 B6X2	tractor_unit	2025-05-27 14:19:11.779471
245	SCANIA	P 250 B6X4	tractor_unit	2025-05-27 14:19:11.795212
246	SCANIA	P 270 B6X2	tractor_unit	2025-05-27 14:19:11.811171
247	SCANIA	P 310 B6X2	tractor_unit	2025-05-27 14:19:11.826389
248	SCANIA	P 310 B6X4	tractor_unit	2025-05-27 14:19:11.842939
249	SCANIA	P 310 B8X2	tractor_unit	2025-05-27 14:19:11.858808
250	SCANIA	P 340 A4X2	tractor_unit	2025-05-27 14:19:11.874624
251	SCANIA	P 340 A6X2	tractor_unit	2025-05-27 14:19:11.890343
252	SCANIA	P 360 A4X2	tractor_unit	2025-05-27 14:19:11.905798
253	SCANIA	P 360 A6X2	tractor_unit	2025-05-27 14:19:11.920955
254	SCANIA	P 360 B6X2	tractor_unit	2025-05-27 14:19:11.93651
255	SCANIA	P 360 B6X4 CS	tractor_unit	2025-05-27 14:19:11.951918
256	SCANIA	P 420 A6X4	tractor_unit	2025-05-27 14:19:11.967231
257	SCANIA	P114GA4X2NZ 330	tractor_unit	2025-05-27 14:19:11.982499
258	SCANIA	P114GA4X2NZ 340	tractor_unit	2025-05-27 14:19:11.997893
259	SCANIA	P114GA4X2NZ 360	tractor_unit	2025-05-27 14:19:12.013287
260	SCANIA	P124CA6X4NZ 400	tractor_unit	2025-05-27 14:19:12.028491
261	SCANIA	P124CA6X4NZ 420	tractor_unit	2025-05-27 14:19:12.043825
262	SCANIA	P124CB6X4NZ 420	tractor_unit	2025-05-27 14:19:12.070027
263	SCANIA	P124CB8X4NZ 420	tractor_unit	2025-05-27 14:19:12.085964
264	SCANIA	P124GA4X2NZ 360	tractor_unit	2025-05-27 14:19:12.10168
265	SCANIA	P360 B8X2	tractor_unit	2025-05-27 14:19:12.116826
266	SCANIA	P370 A4X2	tractor_unit	2025-05-27 14:19:12.132258
267	SCANIA	R 113 H 4X2	tractor_unit	2025-05-27 14:19:12.147582
268	SCANIA	R 124 LA6X2NA 360	tractor_unit	2025-05-27 14:19:12.162922
269	SCANIA	R 380 A4X2	tractor_unit	2025-05-27 14:19:12.178145
270	SCANIA	R 400 A6X2	tractor_unit	2025-05-27 14:19:12.194646
271	SCANIA	R 410 A4X2	tractor_unit	2025-05-27 14:19:12.210197
272	SCANIA	R 420 A4X2	tractor_unit	2025-05-27 14:19:12.226019
273	SCANIA	R 420 A6X2	tractor_unit	2025-05-27 14:19:12.241986
274	SCANIA	R 420 A6X4	tractor_unit	2025-05-27 14:19:12.257255
275	SCANIA	R 440 A4X2	tractor_unit	2025-05-27 14:19:12.273618
276	SCANIA	R 440 A6X2	tractor_unit	2025-05-27 14:19:12.288794
277	SCANIA	R 440 A6X4	tractor_unit	2025-05-27 14:19:12.304156
278	SCANIA	R 460 A6X2	tractor_unit	2025-05-27 14:19:12.319716
279	SCANIA	R 470 A6X2	tractor_unit	2025-05-27 14:19:12.335319
280	SCANIA	R 470 A6X4	tractor_unit	2025-05-27 14:19:12.350613
281	SCANIA	R 480 A6X4	tractor_unit	2025-05-27 14:19:12.366548
282	SCANIA	R 500 A6X4	tractor_unit	2025-05-27 14:19:12.382117
283	SCANIA	R 560 A6X4	tractor_unit	2025-05-27 14:19:12.397304
284	SCANIA	R 620 A6X4	tractor_unit	2025-05-27 14:19:12.414303
285	SCANIA	R112 H 4X2	tractor_unit	2025-05-27 14:19:12.430174
286	SCANIA	R112 MA4X2	tractor_unit	2025-05-27 14:19:12.445844
287	SCANIA	R113 H 4X2 320	tractor_unit	2025-05-27 14:19:12.46119
288	SCANIA	R113 H 4X2 360	tractor_unit	2025-05-27 14:19:12.47696
289	SCANIA	R114 GA4X2NZ 320	tractor_unit	2025-05-27 14:19:12.492579
290	SCANIA	R114 GA4X2NZ 380	tractor_unit	2025-05-27 14:19:12.508921
291	SCANIA	R114 GANZ 380	tractor_unit	2025-05-27 14:19:12.524581
292	SCANIA	R114 LA6X2NA 380	tractor_unit	2025-05-27 14:19:12.53954
293	SCANIA	R114GA4X2NZ 380	tractor_unit	2025-05-27 14:19:12.555229
294	SCANIA	R124 GA4X2NZ 360	tractor_unit	2025-05-27 14:19:12.57203
295	SCANIA	R124 GA4X2NZ 400	tractor_unit	2025-05-27 14:19:12.590752
296	SCANIA	R124 GA4X2NZ 420	tractor_unit	2025-05-27 14:19:12.606375
297	SCANIA	R124 GA6X4NZ 360	tractor_unit	2025-05-27 14:19:12.621518
298	SCANIA	R124 GA6X4NZ 400	tractor_unit	2025-05-27 14:19:12.637362
299	SCANIA	R124 GA6X4NZ 420	tractor_unit	2025-05-27 14:19:12.653722
300	SCANIA	R124 LA4X2NA 360	tractor_unit	2025-05-27 14:19:12.669505
301	SCANIA	R124 LA4X2NA 420	tractor_unit	2025-05-27 14:19:12.684856
302	SCANIA	R124 LA6X2NA 400	tractor_unit	2025-05-27 14:19:12.70004
303	SCANIA	R124 LA6X2NA 420	tractor_unit	2025-05-27 14:19:12.715229
304	SCANIA	R164GA6X4NZ 480	tractor_unit	2025-05-27 14:19:12.730443
305	SCANIA	R410 A4X2	tractor_unit	2025-05-27 14:19:12.745829
306	SCANIA	R450 A4X2	tractor_unit	2025-05-27 14:19:12.76144
307	SCANIA	R450 A6X2	tractor_unit	2025-05-27 14:19:12.777867
308	SCANIA	R450 A6X4	tractor_unit	2025-05-27 14:19:12.793056
309	SCANIA	R460 A4X2	tractor_unit	2025-05-27 14:19:12.808091
310	SCANIA	R460 A6X2	tractor_unit	2025-05-27 14:19:12.823228
311	SCANIA	R500 A6X4	tractor_unit	2025-05-27 14:19:12.83909
312	SCANIA	R510 A6X4	tractor_unit	2025-05-27 14:19:12.854354
313	SCANIA	R540 A4X2	tractor_unit	2025-05-27 14:19:12.870014
314	SCANIA	R540 A6X4	tractor_unit	2025-05-27 14:19:12.885329
315	SCANIA	R560 A6X4	tractor_unit	2025-05-27 14:19:12.900823
316	SCANIA	R620 A6X4	tractor_unit	2025-05-27 14:19:12.916078
317	SCANIA	S450 A4X2	tractor_unit	2025-05-27 14:19:12.931734
318	SCANIA	S450 A6X4	tractor_unit	2025-05-27 14:19:12.947085
319	SCANIA	S460 A6X2	tractor_unit	2025-05-27 14:19:12.963014
320	SCANIA	S500 A6X4	tractor_unit	2025-05-27 14:19:12.979375
321	SCANIA	S540 A6X4	tractor_unit	2025-05-27 14:19:12.995319
322	SCANIA	S560 A6X2	tractor_unit	2025-05-27 14:19:13.010853
323	SCANIA	T112 H 4X2	tractor_unit	2025-05-27 14:19:13.02617
324	SCANIA	T112 HS 4X2	tractor_unit	2025-05-27 14:19:13.041432
325	SCANIA	T112 HW 4X2	tractor_unit	2025-05-27 14:19:13.056771
326	SCANIA	T113 H 4X2 310	tractor_unit	2025-05-27 14:19:13.075051
327	SCANIA	T113 H 4X2 320	tractor_unit	2025-05-27 14:19:13.090577
328	SCANIA	T124 GA4X2NZ 360	tractor_unit	2025-05-27 14:19:13.107876
329	SCANIA	T124 GA6X4NZ 420	tractor_unit	2025-05-27 14:19:13.126631
330	SCANIA	T142 H 4X2 S	tractor_unit	2025-05-27 14:19:13.141937
331	SINOTRUCK	A7 H6X4 460A	tractor_unit	2025-05-27 14:19:13.158341
332	SINOTRUCK	HOWO 6X2 380	tractor_unit	2025-05-27 14:19:13.175772
333	SINOTRUCK	HOWO 6X4 380	tractor_unit	2025-05-27 14:19:13.191845
334	V.W	VM 270 8X4R	tractor_unit	2025-05-27 14:19:13.210312
335	V.W	18. 310 TITAN	tractor_unit	2025-05-27 14:19:13.23256
336	V.W	18.310 TITAN	tractor_unit	2025-05-27 14:19:13.249146
337	V.W	19.320 CLC TT	tractor_unit	2025-05-27 14:19:13.265689
338	V.W	19.320 CNC TT	tractor_unit	2025-05-27 14:19:13.282002
339	V.W	19.330 CTC 4X2	tractor_unit	2025-05-27 14:19:13.299473
340	V.W	19.360 CTC 4X2	tractor_unit	2025-05-27 14:19:13.320746
341	V.W	24. 330 CRC 6X2	tractor_unit	2025-05-27 14:19:13.336984
342	V.W	24.280 CRM 6X2	tractor_unit	2025-05-27 14:19:13.353852
343	V.W	24.330 CRC 6X2	tractor_unit	2025-05-27 14:19:13.372113
344	V.W	25.370 CNM T 6X2	tractor_unit	2025-05-27 14:19:13.388281
345	V.W	25.390 CTC 6X2	tractor_unit	2025-05-27 14:19:13.405183
346	V.W	25.420 CTC 6X2	tractor_unit	2025-05-27 14:19:13.420525
347	V.W	26.390 CTC 6X4	tractor_unit	2025-05-27 14:19:13.436005
348	V.W	29.520 METEOR 6X4	tractor_unit	2025-05-27 14:19:13.452689
349	V.W	33.460 CTM 6X4	tractor_unit	2025-05-27 14:19:13.470407
350	V.W	13.130	tractor_unit	2025-05-27 14:19:13.485804
351	V.W	24.320 CLC	tractor_unit	2025-05-27 14:19:13.501355
352	V.W	31.330 CRC 6X4 CMT 63 (Nome Oficial: 31.330 CRC 6X4)	tractor_unit	2025-05-27 14:19:13.516583
353	V.W	VW 31.280 CRM 6X4	tractor_unit	2025-05-27 14:19:13.531872
354	V.W	19.370 CLM T 4X2	tractor_unit	2025-05-27 14:19:13.547307
355	V.W	19.390 CTC 4X2	tractor_unit	2025-05-27 14:19:13.563242
356	V.W	19.420 CTC 4x2	tractor_unit	2025-05-27 14:19:13.578566
357	V.W	25.320 CNC T 6X2	tractor_unit	2025-05-27 14:19:13.593684
358	V.W	26.420 CTC 6X4	tractor_unit	2025-05-27 14:19:13.609433
359	V.W	9.150 E-CUMIS	tractor_unit	2025-05-27 14:19:13.626355
360	V.W	BMB 25.320 CNC 6X2	tractor_unit	2025-05-27 14:19:13.642795
361	V.W	8.160 DRC 4X2	tractor_unit	2025-05-27 14:19:13.659297
362	V.W	32.360 CRC 6X4	tractor_unit	2025-05-27 14:19:13.674279
363	V.W	17.300	tractor_unit	2025-05-27 14:19:13.689497
364	V.W	23.220	tractor_unit	2025-05-27 14:19:13.704876
365	V.W	26.300	tractor_unit	2025-05-27 14:19:13.721535
366	V.W	40.300	tractor_unit	2025-05-27 14:19:13.737268
367	V.W	15.190 CRM 4X2	tractor_unit	2025-05-27 14:19:13.752484
368	V.W	20.480 CTM 4X2	tractor_unit	2025-05-27 14:19:13.767699
369	V.W	24.250 CNC 6X2	tractor_unit	2025-05-27 14:19:13.782889
370	V.W	24.250 MASTER	tractor_unit	2025-05-27 14:19:13.799109
371	V.W	24.320 CLC 6X2	tractor_unit	2025-05-27 14:19:13.815602
372	V.W	25.360 CTC 6X2	tractor_unit	2025-05-27 14:19:13.830931
373	V.W	25.370 CLM T 6X2	tractor_unit	2025-05-27 14:19:13.846432
374	V.W	28.480 MTM 6X2	tractor_unit	2025-05-27 14:19:13.861665
375	V.W	29.530 MTM 6X4	tractor_unit	2025-05-27 14:19:13.878514
376	V.W	31.280 CRM 6X4	tractor_unit	2025-05-27 14:19:13.894861
377	V.W	31.320 CRM 6X4	tractor_unit	2025-05-27 14:19:13.910265
378	V.W	31.330 CRC 6X4	tractor_unit	2025-05-27 14:19:13.925432
379	V.W	32.380 CRC 6X4	tractor_unit	2025-05-27 14:19:13.942574
380	V.W	33.480 CTM 6X4	tractor_unit	2025-05-27 14:19:13.95911
381	V.W	26.370 CLM T 6X4	tractor_unit	2025-05-27 14:19:13.979086
382	VOLVO	FH12 380 4X2	tractor_unit	2025-05-27 14:19:13.994717
383	VOLVO	FH 400 6X2T	tractor_unit	2025-05-27 14:19:14.010134
384	VOLVO	FH 460 6X2T	tractor_unit	2025-05-27 14:19:14.025375
385	VOLVO	FH 460 6X4T	tractor_unit	2025-05-27 14:19:14.041284
386	VOLVO	FH 480 6X4T	tractor_unit	2025-05-27 14:19:14.057157
387	VOLVO	FH 500 6X4T	tractor_unit	2025-05-27 14:19:14.072349
388	VOLVO	FH 520 6X4T	tractor_unit	2025-05-27 14:19:14.088637
389	VOLVO	FH 540 6X4T	tractor_unit	2025-05-27 14:19:14.104734
390	VOLVO	310 6X4R	tractor_unit	2025-05-27 14:19:14.119827
391	VOLVO	FH 400 4X2T	tractor_unit	2025-05-27 14:19:14.135376
392	VOLVO	FH 400 6X4T	tractor_unit	2025-05-27 14:19:14.150984
393	VOLVO	FH 420 4X2T	tractor_unit	2025-05-27 14:19:14.166373
394	VOLVO	FH 440 4X2T	tractor_unit	2025-05-27 14:19:14.181557
395	VOLVO	FH 440 6X2T	tractor_unit	2025-05-27 14:19:14.198409
396	VOLVO	FH 440 6X4R	tractor_unit	2025-05-27 14:19:14.213682
397	VOLVO	FH 440 6X4T	tractor_unit	2025-05-27 14:19:14.228933
398	VOLVO	FH 440 GER	tractor_unit	2025-05-27 14:19:14.244513
399	VOLVO	FH 460 4X2T	tractor_unit	2025-05-27 14:19:14.260688
400	VOLVO	FH 460 6X4T SUSP	tractor_unit	2025-05-27 14:19:14.275973
401	VOLVO	FH 480 4X2T	tractor_unit	2025-05-27 14:19:14.291189
402	VOLVO	FH 500 4X2T	tractor_unit	2025-05-27 14:19:14.306796
403	VOLVO	FH 500 6X2T	tractor_unit	2025-05-27 14:19:14.322037
404	VOLVO	FH 540 6X4T SUSP	tractor_unit	2025-05-27 14:19:14.33739
405	VOLVO	FH 540 MASTER	tractor_unit	2025-05-27 14:19:14.352354
406	VOLVO	FH 8X4T	tractor_unit	2025-05-27 14:19:14.368295
407	VOLVO	FH12 380	tractor_unit	2025-05-27 14:19:14.383519
408	VOLVO	FH12 380 4X2 T	tractor_unit	2025-05-27 14:19:14.399035
409	VOLVO	FH12 380 4X2T	tractor_unit	2025-05-27 14:19:14.416158
410	VOLVO	FH12 380 6X2T	tractor_unit	2025-05-27 14:19:14.431225
411	VOLVO	FH12 380 6X4T	tractor_unit	2025-05-27 14:19:14.44672
412	VOLVO	FH12 420	tractor_unit	2025-05-27 14:19:14.461746
413	VOLVO	FH12 420 4X2T	tractor_unit	2025-05-27 14:19:14.47692
414	VOLVO	FH12 420 6X2T	tractor_unit	2025-05-27 14:19:14.492084
415	VOLVO	FH12 420 6X4	tractor_unit	2025-05-27 14:19:14.507091
416	VOLVO	FH12 420 6X4T	tractor_unit	2025-05-27 14:19:14.522863
417	VOLVO	FH12 460 4X2T	tractor_unit	2025-05-27 14:19:14.538047
418	VOLVO	FH12 460 6X4T	tractor_unit	2025-05-27 14:19:14.553212
419	VOLVO	FM 370 4X2T	tractor_unit	2025-05-27 14:19:14.568637
420	VOLVO	FM 370 6X2T	tractor_unit	2025-05-27 14:19:14.583799
421	VOLVO	FM 400 6X4R GERM	tractor_unit	2025-05-27 14:19:14.59902
422	VOLVO	FM 440 6X4R	tractor_unit	2025-05-27 14:19:14.614121
423	VOLVO	FM 440 6X4T	tractor_unit	2025-05-27 14:19:14.629345
424	VOLVO	FM 460 6X4R	tractor_unit	2025-05-27 14:19:14.644462
425	VOLVO	FM 480 6X4	tractor_unit	2025-05-27 14:19:14.659879
426	VOLVO	FM 480 6X4R	tractor_unit	2025-05-27 14:19:14.674967
427	VOLVO	FM 480 6X4T	tractor_unit	2025-05-27 14:19:14.690474
428	VOLVO	FM 500 6X4T	tractor_unit	2025-05-27 14:19:14.705766
429	VOLVO	FM 540 6X4R	tractor_unit	2025-05-27 14:19:14.721006
430	VOLVO	FM 540 6X4T	tractor_unit	2025-05-27 14:19:14.736125
431	VOLVO	FM12 340 4X2T	tractor_unit	2025-05-27 14:19:14.751445
432	VOLVO	FM12 380 6X4T	tractor_unit	2025-05-27 14:19:14.76675
433	VOLVO	FM12 420 6X4R	tractor_unit	2025-05-27 14:19:14.782346
434	VOLVO	FM12 420 6X4T	tractor_unit	2025-05-27 14:19:14.79779
435	VOLVO	N10	tractor_unit	2025-05-27 14:19:14.81366
436	VOLVO	N10 HT IC	tractor_unit	2025-05-27 14:19:14.829603
437	VOLVO	NH12380 4X2 T	tractor_unit	2025-05-27 14:19:14.844795
438	VOLVO	NH12380 4X2T	tractor_unit	2025-05-27 14:19:14.859807
439	VOLVO	NL10 340	tractor_unit	2025-05-27 14:19:14.874884
440	VOLVO	NL10 340 4X2	tractor_unit	2025-05-27 14:19:14.890268
441	VOLVO	NL12 360 4X2T EDC	tractor_unit	2025-05-27 14:19:14.905414
442	VOLVO	NL12 400	tractor_unit	2025-05-27 14:19:14.920667
443	VOLVO	NL12 410 4X2T EDC	tractor_unit	2025-05-27 14:19:14.935909
444	VOLVO	VM 260 6X2R	tractor_unit	2025-05-27 14:19:14.951632
445	VOLVO	VM 290 6X4 R	tractor_unit	2025-05-27 14:19:14.966847
446	VOLVO	VM 310 4X2T	tractor_unit	2025-05-27 14:19:14.982256
447	VOLVO	VM 310 6X4R	tractor_unit	2025-05-27 14:19:14.998458
448	VOLVO	VM 330 6X4R	tractor_unit	2025-05-27 14:19:15.013978
449	VOLVO	VM 330 8X2R	tractor_unit	2025-05-27 14:19:15.029383
450	VOLVO	VM 330 8X2T	tractor_unit	2025-05-27 14:19:15.044661
451	VOLVO	VM 360 6x2 R	tractor_unit	2025-05-27 14:19:15.060588
452	VOLVO	VM 360 6X4 R	tractor_unit	2025-05-27 14:19:15.076024
453	VOLVO	VM 360 8X2 R	tractor_unit	2025-05-27 14:19:15.091262
454	VOLVO	VM330 6X2R	tractor_unit	2025-05-27 14:19:15.106865
\.


--
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vehicles (id, user_id, plate, type, brand, model, year, renavam, tare, axle_count, remarks, crlv_year, crlv_url, status, body_type) FROM stdin;
11	2	MNO5H01	semi_trailer	RANDON	SR BA	2023	78542400005	7500	3	Semirreboque graneleiro	2023	\N	active	\N
12	2	PQR6I23	semi_trailer	RANDON	SR BA	2023	78542400006	7500	3	Semirreboque graneleiro	2023	\N	active	\N
13	2	STU7J45	semi_trailer	RANDON	SR BA	2023	78542400007	7500	3	Semirreboque graneleiro	2023	\N	active	\N
14	2	VWX8K67	semi_trailer	RANDON	SR BA	2023	78542400008	7500	3	Semirreboque graneleiro	2023	\N	active	\N
15	2	YZA9L89	semi_trailer	RANDON	SR BA	2023	78542400009	7500	3	Semirreboque graneleiro	2023	\N	active	\N
16	2	BCD1M01	semi_trailer	RANDON	SR BA	2023	78542400010	7500	3	Semirreboque graneleiro	2023	\N	active	\N
17	2	EFG2N23	semi_trailer	RANDON	SR BA	2023	78542400011	7500	3	Semirreboque graneleiro	2023	\N	active	\N
18	2	HIJ3O45	semi_trailer	RANDON	SR BA	2023	78542400012	7500	3	Semirreboque graneleiro	2023	\N	active	\N
19	2	KLM4P67	semi_trailer	RANDON	SR BA	2023	78542400013	7500	3	Semirreboque graneleiro	2023	\N	active	\N
20	2	NOP5Q89	semi_trailer	RANDON	SR BA	2023	78542400014	7500	3	Semirreboque graneleiro	2023	\N	active	\N
21	2	QRS6R01	semi_trailer	RANDON	SR BA	2023	78542400015	7500	3	Semirreboque graneleiro	2023	\N	active	\N
22	2	TUV7S23	semi_trailer	RANDON	SR BA	2023	78542400016	7500	3	Semirreboque graneleiro	2023	\N	active	\N
23	2	WXY8T45	semi_trailer	RANDON	SR BA	2023	78542400017	7500	3	Semirreboque graneleiro	2023	\N	active	\N
24	2	ZAB9U67	semi_trailer	RANDON	SR BA	2023	78542400018	7500	3	Semirreboque graneleiro	2023	\N	active	\N
25	2	CDE1V89	semi_trailer	RANDON	SR BA	2023	78542400019	7500	3	Semirreboque graneleiro	2023	\N	active	\N
28	2	RAU8H04	semi_trailer	RANDON	SR BA	2025	\N	7	\N	\N	2025	\N	active	\N
26	2	RAU8G84	semi_trailer	RANDON	SR BA	2018	98765432101	7000	2		2022	\N	active	\N
30	2	QWE2536	flatbed	RANDON	SR BA	2024	123456	7500	2	\N	2025	\N	active	\N
2	2	XYZ5678	semi_trailer	RANDON	SR BA	2018	98765432101	7000	3	Semirreboque graneleiro	2022	\N	active	dump
31	3	REQ3252	tractor_unit	scani	540	2024	0001215151	9890	3	\N	2025	\N	active	\N
32	3	QWE1234	flatbed	FACCHINI	SR CA	2021	45678912301	7000	3	\N	2024	\N	active	\N
1	2	ABC1234	tractor_unit	SCANIA	R450	2020	12345678901	9000	3	Cavalo mecânico em bom estado	2023	\N	active	\N
3	2	DEF9012	semi_trailer	FACCHINI	SR CA	2019	45678912301	6500	2	Semirreboque carga seca	2021	/uploads/crlvFile-1747243701552-856062950.pdf	active	\N
6	2	SBG9L01	semi_trailer	RANDON	SR BA	2023	78542400058	7500	3	Semirreboque graneleiro	2023	/uploads/crlvFile-1747243710442-514601599.pdf	active	\N
8	2	DEF2E45	semi_trailer	RANDON	SR BA	2023	78542400002	7500	3	Semirreboque graneleiro	2023	/uploads/crlvFile-1747243736129-348585249.pdf	active	\N
7	2	ABC1D23	flatbed	RANDON	SR BA	2023	78542400001	7500	3	Semirreboque graneleiro	2023	\N	active	\N
10	2	JKL4G89	semi_trailer	RANDON	SR BA	2023	78542400004	7.525	3	Semirreboque graneleiro	2023	\N	active	\N
9	2	GHI3F67	semi_trailer	RANDON	SR BA	2023	78542400003	7500	3	Semirreboque graneleiro	2023	\N	active	\N
34	8	BDI1A71	tractor_unit	VOLVO	FH 540 6X4T	2019	01201268939	9.92	3	\N	2024	/uploads/crlvFile-1748458496881-180963364.pdf	active	\N
35	8	RHM8B76	tractor_unit	VOLVO	FH 540 6X4T	2018	01279686950	9.92	3	\N	2024	/uploads/crlvFile-1748458562110-370769538.pdf	active	\N
\.


--
-- Name: license_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.license_requests_id_seq', 108, true);


--
-- Name: status_histories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.status_histories_id_seq', 31, true);


--
-- Name: transporters_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.transporters_id_seq', 5, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 9, true);


--
-- Name: vehicle_models_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vehicle_models_id_seq', 454, true);


--
-- Name: vehicles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vehicles_id_seq', 35, true);


--
-- Name: license_requests license_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_requests
    ADD CONSTRAINT license_requests_pkey PRIMARY KEY (id);


--
-- Name: license_requests license_requests_request_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_requests
    ADD CONSTRAINT license_requests_request_number_unique UNIQUE (request_number);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: status_histories status_histories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_histories
    ADD CONSTRAINT status_histories_pkey PRIMARY KEY (id);


--
-- Name: transporters transporters_document_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transporters
    ADD CONSTRAINT transporters_document_number_unique UNIQUE (document_number);


--
-- Name: transporters transporters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transporters
    ADD CONSTRAINT transporters_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vehicle_models vehicle_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_models
    ADD CONSTRAINT vehicle_models_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- Name: idx_status_history_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_status_history_created_at ON public.status_histories USING btree (created_at);


--
-- Name: idx_status_history_license_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_status_history_license_id ON public.status_histories USING btree (license_id);


--
-- Name: idx_status_history_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_status_history_state ON public.status_histories USING btree (state);


--
-- Name: idx_status_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_status_history_user_id ON public.status_histories USING btree (user_id);


--
-- Name: license_requests license_requests_dolly_id_vehicles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_requests
    ADD CONSTRAINT license_requests_dolly_id_vehicles_id_fk FOREIGN KEY (dolly_id) REFERENCES public.vehicles(id);


--
-- Name: license_requests license_requests_first_trailer_id_vehicles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_requests
    ADD CONSTRAINT license_requests_first_trailer_id_vehicles_id_fk FOREIGN KEY (first_trailer_id) REFERENCES public.vehicles(id);


--
-- Name: license_requests license_requests_flatbed_id_vehicles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_requests
    ADD CONSTRAINT license_requests_flatbed_id_vehicles_id_fk FOREIGN KEY (flatbed_id) REFERENCES public.vehicles(id);


--
-- Name: license_requests license_requests_second_trailer_id_vehicles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_requests
    ADD CONSTRAINT license_requests_second_trailer_id_vehicles_id_fk FOREIGN KEY (second_trailer_id) REFERENCES public.vehicles(id);


--
-- Name: license_requests license_requests_tractor_unit_id_vehicles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_requests
    ADD CONSTRAINT license_requests_tractor_unit_id_vehicles_id_fk FOREIGN KEY (tractor_unit_id) REFERENCES public.vehicles(id);


--
-- Name: license_requests license_requests_transporter_id_transporters_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_requests
    ADD CONSTRAINT license_requests_transporter_id_transporters_id_fk FOREIGN KEY (transporter_id) REFERENCES public.transporters(id);


--
-- Name: license_requests license_requests_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_requests
    ADD CONSTRAINT license_requests_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: status_histories status_histories_license_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_histories
    ADD CONSTRAINT status_histories_license_id_fkey FOREIGN KEY (license_id) REFERENCES public.license_requests(id);


--
-- Name: status_histories status_histories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.status_histories
    ADD CONSTRAINT status_histories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: transporters transporters_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transporters
    ADD CONSTRAINT transporters_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: vehicles vehicles_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

