extends Node3D

const WALL_HEIGHT := 3.2
const WALL_THICKNESS := 0.22
const CORRIDOR_LENGTH := 52.0
const PLAYER_RADIUS := 0.34
const WALK_SPEED := 2.8
const RUN_SPEED := 5.0
const CROUCH_SPEED := 1.45
const START_BATTERY := 30.0

const ROOM_Z := [-10.0, -22.0, -34.0]
const ROOM_LABELS := {
	"west": ["CAMERA 401", "INFERMERIA", "ARCHIVIO"],
	"east": ["CAMERA 402", "TRATTAMENTI", "SICUREZZA"],
}

const CLUES := {
	"registro": {
		"title": "Registro di servizio · 14 novembre 1998",
		"text": "Alle 22:10 il direttore ha ordinato l'evacuazione del Reparto 4. Il registro ufficiale riporta sei persone uscite. La porta dell'isolamento, però, risulta ancora chiusa alle 23:40.",
	},
	"rapporto": {
		"title": "Rapporto d'incidente · copia carbone",
		"text": "Nel rapporto corretto a penna, il nome di Luca Valli è stato cancellato dall'elenco dei presenti. La firma in calce è quella del direttore. Nessun trasferimento risulta registrato.",
	},
	"lettera": {
		"title": "Lettera mai spedita",
		"text": "«Luca non era pericoloso. Gli avevano tolto il sonno per settimane e poi lo chiamavano aggressivo. Ho lasciato la porta chiusa quando è mancata la corrente. Se torno, devo dire la verità.» — Ada, infermiera.",
	},
	"cassetta": {
		"title": "Registrazione · voce del custode",
		"text": "«Ho sentito bussare dall'altra parte. Il direttore mi disse di non aprire e di scrivere che il reparto era vuoto. Ogni notte, da allora, sento ancora quei colpi.»",
	},
}

var player: CharacterBody3D
var player_collision: CollisionShape3D
var camera: Camera3D
var flashlight: SpotLight3D
var stalker: CharacterBody3D
var stalker_mesh: Node3D
var stalker_state := "patrol"
var stalker_stun := 0.0
var stun_cooldown := 0.0
var stalker_clock := 0.0
var patrol_index := 0
var patrol_points: Array[Vector3] = [Vector3(0, 0, -43), Vector3(0, 0, -7), Vector3(0, 0, -31)]

var battery := START_BATTERY
var inventory: Dictionary = {"batteria": false, "fusibile": false, "badge": false}
var found_clues: Dictionary = {}
var active := false
var ended := false
var tutorial_active := false
var tutorial_step := -1
var tutorial_start_position := Vector3.ZERO
var tutorial_crouch_distance := 0.0
var crouched := false
var sprint_noise := 0.0
var message_time := 0.0
var stalker_distance := 100.0

var ui_layer: CanvasLayer
var intro_panel: Control
var ending_panel: Control
var status_label: Label
var objective_label: Label
var inventory_label: Label
var clue_label: Label
var prompt_label: Label
var help_label: Label
var message_label: Label
var noise_bar: ProgressBar
var battery_bar: ProgressBar
var journal_panel: Control
var journal_text: Label
var journal_open := false
var tutorial_label: Label
var tutorial_panel: PanelContainer
var emergency_lights: Array[OmniLight3D] = []

var wall_material: StandardMaterial3D
var floor_material: StandardMaterial3D
var ceiling_material: StandardMaterial3D
var metal_material: StandardMaterial3D


func _ready() -> void:
	_setup_input()
	_setup_materials()
	_build_environment()
	_build_level()
	_build_player()
	_build_stalker()
	_build_ui()
	_update_hud()


func _process(delta: float) -> void:
	if not active or ended or journal_open:
		return

	message_time = maxf(0.0, message_time - delta)
	if message_time == 0.0:
		message_label.text = ""

	if flashlight.visible and battery > 0.0:
		battery = maxf(0.0, battery - delta * 0.58)
		if battery == 0.0:
			flashlight.visible = false
			_show_message("La torcia si è spenta. Trova una batteria di ricambio.")

	var to_stalker := stalker.global_position - player.global_position
	stalker_distance = Vector2(to_stalker.x, to_stalker.z).length()
	var looking_at_stalker := _player_sees_stalker()
	var heard := sprint_noise > 0.0 and stalker_distance < 19.0
	var seen := looking_at_stalker and flashlight.visible and stalker_distance < 14.0

	stun_cooldown = maxf(0.0, stun_cooldown - delta)
	if stalker_stun > 0.0:
		stalker_stun = maxf(0.0, stalker_stun - delta)
		stalker_state = "stunned"
	elif seen and battery > 0.5 and stun_cooldown == 0.0:
		stalker_stun = 1.15
		stun_cooldown = 2.8
		stalker_state = "stunned"
		_show_message("La luce lo costringe a fermarsi. La batteria sta finendo.")
	elif heard or seen or stalker_distance < 8.0:
		stalker_state = "hunt"
	else:
		stalker_state = "patrol"

	if not tutorial_active:
		_update_stalker(delta)
	stalker_clock += delta
	if stalker_mesh:
		stalker_mesh.position.y = sin(stalker_clock * (7.0 if stalker_state == "hunt" else 2.4)) * 0.025
		stalker_mesh.rotation.z = sin(stalker_clock * 3.0) * 0.035 if stalker_state == "hunt" else 0.0
	for index in emergency_lights.size():
		var pulse := 0.78 + sin(stalker_clock * 3.5 + float(index)) * 0.18
		emergency_lights[index].light_energy = pulse
	_update_hud()


func _physics_process(delta: float) -> void:
	if not active or ended or journal_open or player == null:
		return

	var input_vector := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var direction := (player.transform.basis * Vector3(input_vector.x, 0.0, -input_vector.y)).normalized()
	var speed := WALK_SPEED
	crouched = Input.is_action_pressed("crouch")
	if crouched:
		speed = CROUCH_SPEED
	elif Input.is_action_pressed("run"):
		speed = RUN_SPEED

	player.velocity.x = direction.x * speed
	player.velocity.z = direction.z * speed
	player.velocity.y = 0.0
	player.move_and_slide()
	var target_camera_height := 0.49 if crouched else 0.69
	camera.position.y = lerpf(camera.position.y, target_camera_height, delta * 10.0)
	var target_capsule_height := 1.28 if crouched else 1.85
	var capsule := player_collision.shape as CapsuleShape3D
	capsule.height = target_capsule_height
	player_collision.position.y = target_capsule_height * 0.5

	if input_vector.length() > 0.1:
		camera.position.x = sin(Time.get_ticks_msec() * 0.009) * 0.012 if not crouched else 0.0
		if tutorial_active and tutorial_step == 2 and crouched and not flashlight.visible:
			tutorial_crouch_distance += speed * delta
	else:
		camera.position.x = lerpf(camera.position.x, 0.0, delta * 8.0)

	sprint_noise = 0.8 if speed == RUN_SPEED and input_vector.length() > 0.1 else maxf(0.0, sprint_noise - delta)

	if Input.is_action_just_pressed("interact"):
		_interact()

	if tutorial_active:
		_update_tutorial(input_vector, delta)

	if stalker_distance < 1.2:
		_end_game(false)


func _unhandled_input(event: InputEvent) -> void:
	if not active or ended:
		return
	if event is InputEventMouseMotion:
		player.rotate_y(-event.relative.x * 0.0022)
		camera.rotate_x(-event.relative.y * 0.0022)
		camera.rotation.x = clampf(camera.rotation.x, -1.35, 1.35)
	elif event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ESCAPE:
			if journal_open:
				_toggle_journal()
			else:
				Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		elif event.keycode == KEY_F:
			_toggle_flashlight()
		elif event.keycode == KEY_J:
			_toggle_journal()
		elif event.keycode == KEY_T and tutorial_active:
			_finish_tutorial()
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _setup_input() -> void:
	_add_key_action("move_forward", KEY_W)
	_add_key_action("move_back", KEY_S)
	_add_key_action("move_left", KEY_A)
	_add_key_action("move_right", KEY_D)
	_add_key_action("run", KEY_SHIFT)
	_add_key_action("crouch", KEY_CTRL)
	_add_key_action("interact", KEY_E)


func _add_key_action(action: String, key: Key) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	var event := InputEventKey.new()
	event.physical_keycode = key
	InputMap.action_add_event(action, event)


func _setup_materials() -> void:
	wall_material = _pbr_material("blue_plaster_weathered", Vector3(2.6, 1.0, 1.0), Color(0.66, 0.72, 0.72))
	floor_material = _pbr_material("anti_skid_tiles", Vector3(2.0, 1.0, 2.0), Color(0.7, 0.72, 0.7))
	ceiling_material = StandardMaterial3D.new()
	ceiling_material.albedo_color = Color(0.11, 0.12, 0.12)
	ceiling_material.roughness = 0.98
	metal_material = _pbr_material("blue_metal_plate", Vector3.ONE, Color(0.68, 0.72, 0.73))


func _pbr_material(folder: String, uv_scale: Vector3, tint: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	var base := "res://textures/reparto4/%s/" % folder
	var albedo := load(base + "diff.jpg") as Texture2D
	var normal := load(base + "nor_gl.jpg") as Texture2D
	var roughness := load(base + "rough.jpg") as Texture2D
	material.albedo_texture = albedo
	material.normal_enabled = true
	material.normal_texture = normal
	material.roughness_texture = roughness
	material.albedo_color = tint
	material.roughness = 0.92
	material.uv1_scale = uv_scale
	return material


func _build_environment() -> void:
	var world := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color(0.008, 0.012, 0.016)
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color(0.2, 0.24, 0.28)
	environment.ambient_light_energy = 0.32
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment.tonemap_exposure = 1.12
	environment.glow_enabled = true
	environment.glow_intensity = 0.28
	environment.fog_enabled = true
	environment.fog_light_color = Color(0.025, 0.035, 0.04)
	environment.fog_density = 0.012
	world.environment = environment
	add_child(world)

	var moonlight := DirectionalLight3D.new()
	moonlight.rotation_degrees = Vector3(-28, -20, 0)
	moonlight.light_color = Color(0.33, 0.4, 0.48)
	moonlight.light_energy = 0.12
	moonlight.shadow_enabled = true
	add_child(moonlight)


func _build_level() -> void:
	_add_box(self, Vector3(0, -0.16, -CORRIDOR_LENGTH / 2), Vector3(3.2, 0.32, CORRIDOR_LENGTH), floor_material)
	_add_box(self, Vector3(0, WALL_HEIGHT + 0.08, -CORRIDOR_LENGTH / 2), Vector3(3.2, 0.16, CORRIDOR_LENGTH), ceiling_material, false)

	var west_gaps: Array[Vector2] = []
	var east_gaps: Array[Vector2] = []
	for z in ROOM_Z:
		west_gaps.append(Vector2(z - 1.0, z + 1.0))
		east_gaps.append(Vector2(z - 1.0, z + 1.0))
	_add_wall_z(-1.6, -CORRIDOR_LENGTH, 0.0, wall_material, west_gaps)
	_add_wall_z(1.6, -CORRIDOR_LENGTH, 0.0, wall_material, east_gaps)
	_add_wall_x(0.0, -1.6, 1.6, wall_material)
	_add_wall_x(-CORRIDOR_LENGTH, -1.6, 1.6, wall_material, [Vector2(-0.8, 0.8)])

	for z in ROOM_Z:
		_add_side_room("west", z, wall_material)
		_add_side_room("east", z, wall_material)
	_add_handrails(-1.42, west_gaps)
	_add_handrails(1.42, east_gaps)

	for z in range(-4, -52, -8):
		_add_light_fixture(Vector3(0, 3.0, z), z == -4 or z == -20 or z == -44)
	_add_emergency_light(Vector3(-1.34, 2.65, -35.8))
	_add_emergency_light(Vector3(1.34, 2.65, -47.8))

	_add_gurney(Vector3(-0.62, 0.0, -4.0), 0.0)
	_add_gurney(Vector3(0.6, 0.0, -37.0), PI / 2.0)
	_add_locker(Vector3(-1.2, 0.0, -16.0))

	_add_interactable("registro", Vector3(-5.8, 0.9, -8.0), "Indizio · Registro di servizio")
	_add_interactable("batteria", Vector3(5.8, 0.55, -8.2), "Batteria di ricambio · E per raccogliere")
	_add_interactable("fusibile", Vector3(-5.4, 0.65, -22.8), "Fusibile · E per raccogliere")
	_add_interactable("rapporto", Vector3(6.7, 0.9, -20.7), "Indizio · Rapporto d'incidente")
	_add_interactable("badge", Vector3(-6.2, 1.0, -32.5), "Tesserino di accesso · E per raccogliere")
	_add_interactable("lettera", Vector3(5.9, 0.9, -33.0), "Indizio · Lettera di Ada")
	_add_interactable("cassetta", Vector3(6.7, 0.55, -35.5), "Indizio · Registrazione del custode")
	_add_interactable("tutorial_batteria", Vector3(0.72, 0.82, -3.0), "Batteria di emergenza · E per raccogliere")

	_add_box(self, Vector3(0.0, 1.15, -CORRIDOR_LENGTH + 0.12), Vector3(1.55, 2.3, 0.12), _door_material())
	_add_label(self, "USCITA · ALIMENTAZIONE AUSILIARIA", Vector3(0, 2.55, -50.8), 38, Color(0.55, 0.85, 0.72))
	_add_interactable("uscita", Vector3(0, 1.1, -50.1), "Porta antincendio · E per tentare l'apertura")

	_add_box(self, Vector3(0, -0.16, 1.2), Vector3(3.2, 0.32, 2.4), floor_material)
	_add_box(self, Vector3(0, 0, 1.35), Vector3(3.2, 0.15, 0.2), wall_material)


func _add_side_room(side: String, center_z: float, wall: Material) -> void:
	var inside_x := 1.6 if side == "east" else -1.6
	var outside_x := 8.6 if side == "east" else -8.6
	var min_x: float = minf(inside_x, outside_x)
	var max_x: float = maxf(inside_x, outside_x)
	var center_x: float = (min_x + max_x) * 0.5
	var side_gaps: Array[Vector2] = [Vector2(center_z - 1.0, center_z + 1.0)]

	_add_box(self, Vector3(center_x, -0.16, center_z), Vector3(7.0, 0.32, 8.0), floor_material)
	_add_box(self, Vector3(center_x, WALL_HEIGHT + 0.08, center_z), Vector3(7.0, 0.16, 8.0), ceiling_material, false)
	_add_wall_x(center_z - 4.0, min_x, max_x, wall)
	_add_wall_x(center_z + 4.0, min_x, max_x, wall)
	_add_wall_z(outside_x, center_z - 4.0, center_z + 4.0, wall)
	_add_wall_z(inside_x, center_z - 4.0, center_z + 4.0, wall, side_gaps)

	var labels: Array = ROOM_LABELS[side]
	var room_index: int = ROOM_Z.find(center_z)
	var label_x := inside_x + (-0.12 if side == "east" else 0.12)
	var sign := _add_label(self, labels[room_index], Vector3(label_x, 2.55, center_z + 1.45), 28, Color(0.76, 0.81, 0.78))
	sign.rotation.y = -PI / 2.0 if side == "east" else PI / 2.0
	_add_door_frame(inside_x, center_z)

	if room_index == 0:
		_add_bed(Vector3(inside_x + (1.8 if side == "east" else -1.8), 0, center_z), side == "east")
		_add_bed(Vector3(inside_x + (5.0 if side == "east" else -5.0), 0, center_z), side == "east")
	elif room_index == 1 and side == "west":
		_add_box(self, Vector3(-6.0, 0.5, center_z), Vector3(2.4, 1.0, 1.15), metal_material)
		_add_locker(Vector3(-2.8, 0, center_z + 2.4))
	elif room_index == 2:
		_add_shelf(Vector3(inside_x + (5.8 if side == "east" else -5.8), 0, center_z))
	else:
		_add_bed(Vector3(inside_x + (4.1 if side == "east" else -4.1), 0, center_z), side == "east")

	if side == "west" and center_z == -22.0:
		_add_light_fixture(Vector3(-5.0, 3.0, center_z), true)


func _add_door_frame(x: float, z: float) -> void:
	var frame_material := StandardMaterial3D.new()
	frame_material.albedo_color = Color(0.36, 0.4, 0.39)
	frame_material.metallic = 0.4
	for offset in [-1.02, 1.02]:
		_add_box(self, Vector3(x, 1.08, z + offset), Vector3(0.13, 2.16, 0.13), frame_material, false)
	_add_box(self, Vector3(x, 2.16, z), Vector3(0.13, 0.13, 2.15), frame_material, false)


func _add_wall_x(z: float, x_from: float, x_to: float, material: Material, gaps: Array[Vector2] = []) -> void:
	var cursor := minf(x_from, x_to)
	if gaps.is_empty():
		_add_box(self, Vector3((x_from + x_to) * 0.5, WALL_HEIGHT * 0.5, z), Vector3(x_to - x_from, WALL_HEIGHT, WALL_THICKNESS), material)
		return
	for gap in gaps:
		if gap.x > cursor:
			_add_box(self, Vector3((cursor + gap.x) * 0.5, WALL_HEIGHT * 0.5, z), Vector3(gap.x - cursor, WALL_HEIGHT, WALL_THICKNESS), material)
		cursor = maxf(cursor, gap.y)
	if x_to > cursor:
		_add_box(self, Vector3((cursor + x_to) * 0.5, WALL_HEIGHT * 0.5, z), Vector3(x_to - cursor, WALL_HEIGHT, WALL_THICKNESS), material)


func _add_wall_z(x: float, z_from: float, z_to: float, material: Material, gaps: Array[Vector2] = []) -> void:
	var cursor := minf(z_from, z_to)
	if gaps.is_empty():
		_add_box(self, Vector3(x, WALL_HEIGHT * 0.5, (z_from + z_to) * 0.5), Vector3(WALL_THICKNESS, WALL_HEIGHT, z_to - z_from), material)
		return
	var sorted_gaps := gaps.duplicate()
	sorted_gaps.sort_custom(func(a: Vector2, b: Vector2) -> bool: return a.x < b.x)
	for gap in sorted_gaps:
		if gap.x > cursor:
			_add_box(self, Vector3(x, WALL_HEIGHT * 0.5, (cursor + gap.x) * 0.5), Vector3(WALL_THICKNESS, WALL_HEIGHT, gap.x - cursor), material)
		cursor = maxf(cursor, gap.y)
	if z_to > cursor:
		_add_box(self, Vector3(x, WALL_HEIGHT * 0.5, (cursor + z_to) * 0.5), Vector3(WALL_THICKNESS, WALL_HEIGHT, z_to - cursor), material)


func _add_handrails(x: float, gaps: Array[Vector2]) -> void:
	var rail_material := StandardMaterial3D.new()
	rail_material.albedo_color = Color(0.32, 0.35, 0.34)
	rail_material.metallic = 0.55
	var cursor := -CORRIDOR_LENGTH
	var sorted_gaps := gaps.duplicate()
	sorted_gaps.sort_custom(func(a: Vector2, b: Vector2) -> bool: return a.x < b.x)
	for gap in sorted_gaps:
		if gap.x > cursor:
			_add_rail_segment(x, cursor, gap.x, rail_material)
		cursor = maxf(cursor, gap.y)
	if cursor < 0:
		_add_rail_segment(x, cursor, 0.0, rail_material)


func _add_rail_segment(x: float, z_from: float, z_to: float, material: Material) -> void:
	var mesh := MeshInstance3D.new()
	var cylinder := CylinderMesh.new()
	cylinder.top_radius = 0.035
	cylinder.bottom_radius = 0.035
	cylinder.height = z_to - z_from
	cylinder.material = material
	mesh.mesh = cylinder
	mesh.position = Vector3(x, 0.82, (z_from + z_to) * 0.5)
	mesh.rotation.x = PI / 2.0
	add_child(mesh)


func _add_box(parent: Node3D, center: Vector3, size: Vector3, material: Material, collidable := true) -> MeshInstance3D:
	var mesh_instance := MeshInstance3D.new()
	var box_mesh := BoxMesh.new()
	box_mesh.size = size
	box_mesh.material = material
	mesh_instance.mesh = box_mesh
	mesh_instance.position = center
	mesh_instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	parent.add_child(mesh_instance)
	if collidable:
		var body := StaticBody3D.new()
		body.position = center
		var shape_node := CollisionShape3D.new()
		var shape := BoxShape3D.new()
		shape.size = size
		shape_node.shape = shape
		body.add_child(shape_node)
		parent.add_child(body)
	return mesh_instance


func _add_bed(position: Vector3, east: bool) -> void:
	var bed := Node3D.new()
	bed.position = position
	add_child(bed)
	_add_box(bed, Vector3(0, 0.34, 0), Vector3(1.0, 0.5, 2.0), metal_material)
	var mattress := StandardMaterial3D.new()
	mattress.albedo_color = Color(0.35, 0.38, 0.34)
	mattress.roughness = 0.98
	_add_box(bed, Vector3(0, 0.62, 0), Vector3(0.92, 0.13, 1.88), mattress, false)
	for x in [-0.42, 0.42]:
		for z in [-0.82, 0.82]:
			_add_box(bed, Vector3(x, 0.17, z), Vector3(0.06, 0.34, 0.06), metal_material)


func _add_gurney(position: Vector3, rotation_y: float) -> void:
	var gurney := Node3D.new()
	gurney.position = position
	gurney.rotation.y = rotation_y
	add_child(gurney)
	_add_box(gurney, Vector3(0, 0.74, 0), Vector3(0.74, 0.09, 1.85), metal_material)
	for x in [-0.29, 0.29]:
		for z in [-0.77, 0.77]:
			_add_box(gurney, Vector3(x, 0.37, z), Vector3(0.06, 0.74, 0.06), metal_material)


func _add_locker(position: Vector3) -> void:
	_add_box(self, position + Vector3(0, 1.0, 0), Vector3(0.65, 2.0, 0.55), metal_material)


func _add_shelf(position: Vector3) -> void:
	var shelf_material := StandardMaterial3D.new()
	shelf_material.albedo_color = Color(0.28, 0.29, 0.27)
	for y in [0.4, 1.0, 1.6]:
		_add_box(self, position + Vector3(0, y, 0), Vector3(1.55, 0.07, 0.48), shelf_material)
	for x in [-0.7, 0.7]:
		_add_box(self, position + Vector3(x, 1.0, 0), Vector3(0.07, 2.0, 0.48), shelf_material)


func _add_light_fixture(position: Vector3, working: bool) -> void:
	var fixture_material := StandardMaterial3D.new()
	fixture_material.albedo_color = Color(0.65, 0.68, 0.66) if working else Color(0.12, 0.13, 0.13)
	if working:
		fixture_material.emission_enabled = true
		fixture_material.emission = Color(0.65, 0.78, 0.82)
		fixture_material.emission_energy_multiplier = 0.75
	_add_box(self, position, Vector3(0.9, 0.07, 0.22), fixture_material, false)
	if working:
		var light := OmniLight3D.new()
		light.position = position - Vector3(0, 0.18, 0)
		light.light_color = Color(0.62, 0.75, 0.82)
		light.light_energy = 0.85
		light.omni_range = 6.5
		add_child(light)


func _door_material() -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = Color(0.22, 0.24, 0.23)
	material.metallic = 0.58
	material.roughness = 0.74
	return material


func _add_label(parent: Node3D, text: String, position: Vector3, font_size: int, color: Color) -> Label3D:
	var label := Label3D.new()
	label.text = text
	label.position = position
	label.font_size = font_size
	label.modulate = color
	label.outline_size = 7
	label.outline_modulate = Color(0.02, 0.03, 0.03)
	label.pixel_size = 0.002
	parent.add_child(label)
	return label


func _add_interactable(kind: String, position: Vector3, prompt: String) -> void:
	var area := Area3D.new()
	area.position = position
	area.collision_layer = 2
	area.collision_mask = 0
	area.set_meta("kind", kind)
	area.set_meta("prompt", prompt)
	var collision := CollisionShape3D.new()
	var sphere := SphereShape3D.new()
	sphere.radius = 0.72
	collision.shape = sphere
	area.add_child(collision)

	var item_mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(0.32, 0.12, 0.24)
	var item_material := StandardMaterial3D.new()
	item_material.albedo_color = _item_color(kind)
	item_material.metallic = 0.25
	item_material.roughness = 0.48
	item_mesh.mesh = box
	item_mesh.material_override = item_material
	area.add_child(item_mesh)
	add_child(area)


func _item_color(kind: String) -> Color:
	match kind:
		"batteria":
			return Color(0.62, 0.79, 0.45)
		"fusibile":
			return Color(0.9, 0.67, 0.28)
		"badge":
			return Color(0.38, 0.72, 0.82)
		"uscita":
			return Color(0.7, 0.28, 0.2)
		_:
			return Color(0.84, 0.8, 0.63)


func _build_player() -> void:
	player = CharacterBody3D.new()
	player.name = "Player"
	player.position = Vector3(0, 0.94, -2.0)
	player.collision_layer = 1
	player.collision_mask = 1
	var capsule := CapsuleShape3D.new()
	capsule.radius = PLAYER_RADIUS
	capsule.height = 1.85
	var collision := CollisionShape3D.new()
	collision.shape = capsule
	collision.position.y = 0.92
	player.add_child(collision)

	camera = Camera3D.new()
	camera.position.y = 0.69
	camera.current = true
	camera.fov = 76.0
	camera.far = 80.0
	player.add_child(camera)

	flashlight = SpotLight3D.new()
	flashlight.position = Vector3(0.12, -0.1, -0.12)
	flashlight.rotation.x = deg_to_rad(-4.0)
	flashlight.light_color = Color(1.0, 0.91, 0.72)
	flashlight.light_energy = 3.6
	flashlight.spot_range = 18.0
	flashlight.spot_angle = 32.0
	flashlight.spot_angle_attenuation = 0.7
	flashlight.shadow_enabled = true
	flashlight.shadow_bias = 0.04
	camera.add_child(flashlight)
	add_child(player)


func _add_emergency_light(position: Vector3) -> void:
	var face_direction := 1.0 if position.x < 0.0 else -1.0
	var housing := StandardMaterial3D.new()
	housing.albedo_color = Color(0.12, 0.045, 0.035)
	housing.metallic = 0.35
	_add_box(self, position, Vector3(0.16, 0.2, 0.42), housing, false)

	var lens_material := StandardMaterial3D.new()
	lens_material.albedo_color = Color(0.8, 0.14, 0.08)
	lens_material.emission_enabled = true
	lens_material.emission = Color(0.9, 0.12, 0.055)
	lens_material.emission_energy_multiplier = 1.2
	_add_box(self, position + Vector3(face_direction * 0.09, 0, 0), Vector3(0.025, 0.12, 0.3), lens_material, false)

	var light := OmniLight3D.new()
	light.position = position + Vector3(0.22, -0.06, 0)
	light.light_color = Color(0.9, 0.16, 0.09)
	light.light_energy = 0.75
	light.omni_range = 4.5
	light.shadow_enabled = true
	add_child(light)
	emergency_lights.append(light)


func _build_stalker() -> void:
	stalker = CharacterBody3D.new()
	stalker.name = "Degente"
	stalker.position = Vector3(0.0, 0.0, -43.0)
	stalker.collision_layer = 4
	stalker.collision_mask = 1
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.36
	capsule.height = 1.9
	var collision := CollisionShape3D.new()
	collision.shape = capsule
	collision.position.y = 0.95
	stalker.add_child(collision)

	stalker_mesh = Node3D.new()
	stalker_mesh.name = "Silhouette"
	var gown := wall_material.duplicate() as StandardMaterial3D
	gown.albedo_color = Color(0.58, 0.68, 0.65)
	gown.roughness = 0.98
	var skin := StandardMaterial3D.new()
	skin.albedo_color = Color(0.46, 0.43, 0.37)
	skin.roughness = 0.96
	var shadow := StandardMaterial3D.new()
	shadow.albedo_color = Color(0.045, 0.055, 0.052)
	shadow.roughness = 0.95

	var apron := CylinderMesh.new()
	apron.top_radius = 0.25
	apron.bottom_radius = 0.4
	apron.height = 1.14
	apron.radial_segments = 10
	_add_stalker_part(apron, Vector3(0, 0.72, 0), gown)

	var chest := CapsuleMesh.new()
	chest.radius = 0.24
	chest.height = 0.92
	chest.radial_segments = 10
	_add_stalker_part(chest, Vector3(0, 1.28, 0), gown)

	var head := SphereMesh.new()
	head.radius = 0.19
	head.height = 0.4
	head.radial_segments = 12
	head.rings = 8
	_add_stalker_part(head, Vector3(0.015, 1.83, -0.025), skin, Vector3(0, 0, deg_to_rad(-12)))

	var arm := CapsuleMesh.new()
	arm.radius = 0.085
	arm.height = 0.79
	arm.radial_segments = 8
	_add_stalker_part(arm, Vector3(-0.31, 0.95, -0.02), gown, Vector3(0, 0, deg_to_rad(13)))
	_add_stalker_part(arm, Vector3(0.31, 0.96, -0.02), gown, Vector3(0, 0, deg_to_rad(-18)))

	var forearm := CapsuleMesh.new()
	forearm.radius = 0.066
	forearm.height = 0.65
	forearm.radial_segments = 8
	_add_stalker_part(forearm, Vector3(-0.39, 0.46, -0.04), gown, Vector3(0, 0, deg_to_rad(-8)))
	_add_stalker_part(forearm, Vector3(0.4, 0.47, -0.04), gown, Vector3(0, 0, deg_to_rad(11)))

	var leg := CapsuleMesh.new()
	leg.radius = 0.09
	leg.height = 0.68
	leg.radial_segments = 8
	_add_stalker_part(leg, Vector3(-0.15, 0.32, 0.015), shadow)
	_add_stalker_part(leg, Vector3(0.15, 0.32, 0.015), shadow)

	var eye := SphereMesh.new()
	eye.radius = 0.034
	eye.height = 0.065
	eye.radial_segments = 8
	eye.rings = 5
	_add_stalker_part(eye, Vector3(-0.064, 1.85, -0.198), shadow)
	_add_stalker_part(eye, Vector3(0.07, 1.84, -0.195), shadow)

	var restraint := CylinderMesh.new()
	restraint.top_radius = 0.012
	restraint.bottom_radius = 0.012
	restraint.height = 0.22
	_add_stalker_part(restraint, Vector3(-0.42, 0.13, -0.04), metal_material)
	stalker.add_child(stalker_mesh)
	add_child(stalker)


func _add_stalker_part(mesh: PrimitiveMesh, position: Vector3, material: Material, rotation := Vector3.ZERO) -> MeshInstance3D:
	var part := MeshInstance3D.new()
	part.mesh = mesh
	part.material_override = material
	part.position = position
	part.rotation = rotation
	part.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	stalker_mesh.add_child(part)
	return part


func _update_stalker(delta: float) -> void:
	if stalker_stun > 0.0:
		stalker.velocity = Vector3.ZERO
		return

	var target: Vector3
	var speed: float
	if stalker_state == "hunt":
		target = player.global_position
		if absf(player.global_position.x) > 1.25 and absf(stalker.global_position.x) < 1.25:
			target.x = signf(player.global_position.x) * 1.25
		elif absf(player.global_position.x) < 1.25 and absf(stalker.global_position.x) > 1.25:
			target.z = player.global_position.z
		speed = 3.05
	else:
		target = patrol_points[patrol_index]
		speed = 1.18
		if Vector2(stalker.position.x - target.x, stalker.position.z - target.z).length() < 0.7:
			patrol_index = (patrol_index + 1) % patrol_points.size()

	var offset := target - stalker.global_position
	offset.y = 0.0
	if offset.length() > 0.08:
		var direction := offset.normalized()
		stalker.velocity = direction * speed
		stalker.move_and_slide()
		stalker.look_at(stalker.global_position + direction, Vector3.UP)
	else:
		stalker.velocity = Vector3.ZERO


func _player_sees_stalker() -> bool:
	var target := stalker.global_position + Vector3.UP * 1.1
	var to_target := target - camera.global_position
	if to_target.length() > 16.0:
		return false
	if (-camera.global_basis.z).angle_to(to_target.normalized()) > deg_to_rad(24.0):
		return false
	var query := PhysicsRayQueryParameters3D.create(camera.global_position, target, 1)
	query.exclude = [player.get_rid(), stalker.get_rid()]
	return get_world_3d().direct_space_state.intersect_ray(query).is_empty()


func _interact() -> void:
	var from := camera.global_position
	var to := from - camera.global_basis.z * 2.8
	var query := PhysicsRayQueryParameters3D.create(from, to, 2)
	query.collide_with_areas = true
	query.collide_with_bodies = false
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	if hit.is_empty():
		return
	var target: Area3D = hit["collider"]
	var kind: String = target.get_meta("kind", "")
	match kind:
		"batteria":
			battery = minf(100.0, battery + 52.0)
			inventory["batteria"] = true
			target.queue_free()
			_show_message("Batteria di ricambio raccolta. Torcia ricaricata.")
		"tutorial_batteria":
			battery = minf(100.0, battery + 52.0)
			inventory["batteria"] = true
			target.queue_free()
			_show_message("Batteria raccolta. Ora sai come recuperare risorse.")
			if tutorial_active and tutorial_step == 3:
				_finish_tutorial()
		"fusibile":
			inventory["fusibile"] = true
			target.queue_free()
			_show_message("Fusibile raccolto. Serve al quadro elettrico vicino all'uscita.")
		"badge":
			inventory["badge"] = true
			target.queue_free()
			_show_message("Badge del personale raccolto. Potrebbe aprire la porta di sicurezza.")
		"registro", "rapporto", "lettera", "cassetta":
			found_clues[kind] = true
			_show_clue(kind)
			target.queue_free()
		"uscita":
			if not inventory["badge"]:
				_show_message("La serratura non legge il badge. Cerca l'archivio.")
			elif not inventory["fusibile"]:
				_show_message("Il lettore è attivo, ma manca l'alimentazione. Trova un fusibile.")
			else:
				_end_game(true)


func _toggle_flashlight() -> void:
	if battery <= 0.0:
		_show_message("La torcia è scarica. Cerca una batteria di ricambio.")
		return
	flashlight.visible = not flashlight.visible


func _show_clue(kind: String) -> void:
	var clue: Dictionary = CLUES[kind]
	clue_label.text = "%s\n%s" % [clue["title"], clue["text"]]
	clue_label.visible = true
	journal_text.text = _journal_summary()
	_show_message("Documento aggiunto al diario. Premi J per rileggere.")
	_update_hud()


func _journal_summary() -> String:
	if found_clues.is_empty():
		return "Diario vuoto. Cerca registri e documenti nelle stanze laterali."
	var entries: Array[String] = []
	for key in found_clues:
		entries.append("%s\n%s" % [CLUES[key]["title"], CLUES[key]["text"]])
	return "\n\n".join(entries)


func _toggle_journal() -> void:
	journal_open = not journal_open
	journal_panel.visible = journal_open
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if journal_open else Input.MOUSE_MODE_CAPTURED


func _show_message(text: String) -> void:
	message_label.text = text
	message_time = 3.2


func _update_hud() -> void:
	if status_label == null:
		return
	battery_bar.value = battery
	var noise_value := 70.0 if sprint_noise > 0.0 else 12.0 if stalker_state == "hunt" else 0.0
	noise_bar.value = noise_value
	objective_label.text = "OBIETTIVO  Trova badge e fusibile, poi raggiungi l'uscita."
	inventory_label.text = "BADGE %s     FUSIBILE %s     INDIZI %d/4" % [
		"✓" if inventory["badge"] else "—",
		"✓" if inventory["fusibile"] else "—",
		found_clues.size(),
	]
	if not inventory["badge"]:
		objective_label.text = "OBIETTIVO  Trova il badge di sicurezza nell'archivio."
	elif not inventory["fusibile"]:
		objective_label.text = "OBIETTIVO  Trova un fusibile nell'infermeria."
	else:
		objective_label.text = "OBIETTIVO  Raggiungi la porta antincendio in fondo al corridoio."
	if tutorial_active:
		status_label.text = "PRESENZA RILEVATA"
	else:
		status_label.text = "MINACCIA VICINA" if stalker_distance < 12.0 else "TORCIA ACCESA" if flashlight.visible else "TORCIA SPENTA"
	help_label.text = "WASD muovi · SHIFT corri (rumore) · CTRL accovacciati · F torcia · J diario"
	prompt_label.text = ""
	var from := camera.global_position
	var to := from - camera.global_basis.z * 2.8
	var query := PhysicsRayQueryParameters3D.create(from, to, 2)
	query.collide_with_areas = true
	query.collide_with_bodies = false
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	if not hit.is_empty():
		var target: Area3D = hit["collider"]
		prompt_label.text = "E  ·  " + str(target.get_meta("prompt", "Interagisci"))


func _build_ui() -> void:
	ui_layer = CanvasLayer.new()
	add_child(ui_layer)
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui_layer.add_child(root)

	status_label = _make_label(root, "TORCIA ACCESA", Vector2(30, 24), 20, Color(0.83, 0.87, 0.84))
	objective_label = _make_label(root, "", Vector2(30, 55), 17, Color(0.8, 0.82, 0.77))
	inventory_label = _make_label(root, "", Vector2(30, 84), 15, Color(0.62, 0.7, 0.67))
	battery_bar = ProgressBar.new()
	battery_bar.position = Vector2(30, 116)
	battery_bar.size = Vector2(210, 12)
	battery_bar.max_value = 100
	battery_bar.value = START_BATTERY
	battery_bar.show_percentage = false
	root.add_child(battery_bar)

	noise_bar = ProgressBar.new()
	noise_bar.position = Vector2(30, 140)
	noise_bar.size = Vector2(210, 8)
	noise_bar.max_value = 100
	noise_bar.show_percentage = false
	root.add_child(noise_bar)
	_make_label(root, "RUMORE", Vector2(248, 134), 13, Color(0.58, 0.62, 0.6))

	help_label = _make_label(root, "", Vector2(30, 166), 13, Color(0.62, 0.67, 0.64))
	prompt_label = _make_label(root, "", Vector2(30, 190), 15, Color(0.88, 0.83, 0.68))
	message_label = _make_label(root, "", Vector2(30, 220), 17, Color(0.93, 0.84, 0.62))
	message_label.custom_minimum_size = Vector2(640, 32)
	message_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	clue_label = _make_label(root, "", Vector2(30, 258), 15, Color(0.82, 0.8, 0.7))
	clue_label.custom_minimum_size = Vector2(440, 110)
	clue_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	clue_label.visible = false

	tutorial_panel = PanelContainer.new()
	tutorial_panel.anchor_left = 0.5
	tutorial_panel.anchor_right = 0.5
	tutorial_panel.offset_left = -300
	tutorial_panel.offset_right = 300
	tutorial_panel.offset_top = 28
	tutorial_panel.offset_bottom = 126
	tutorial_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var tutorial_style := StyleBoxFlat.new()
	tutorial_style.bg_color = Color(0.025, 0.035, 0.038, 0.9)
	tutorial_style.border_color = Color(0.48, 0.52, 0.47, 0.7)
	tutorial_style.set_border_width_all(1)
	tutorial_style.set_content_margin_all(18)
	tutorial_panel.add_theme_stylebox_override("panel", tutorial_style)
	root.add_child(tutorial_panel)
	tutorial_label = Label.new()
	tutorial_label.add_theme_font_size_override("font_size", 17)
	tutorial_label.add_theme_color_override("font_color", Color(0.85, 0.86, 0.8))
	tutorial_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	tutorial_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	tutorial_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	tutorial_panel.add_child(tutorial_label)
	tutorial_panel.visible = false

	var crosshair := _make_label(root, "·", Vector2.ZERO, 30, Color(0.9, 0.9, 0.82))
	crosshair.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	crosshair.position = Vector2(-8, -20)
	crosshair.size = Vector2(16, 30)
	crosshair.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER

	intro_panel = _make_overlay(root)
	var intro_content := _make_center_card(intro_panel)
	_make_label(intro_content, "REPARTO 4", Vector2.ZERO, 42, Color(0.84, 0.86, 0.78))
	var intro_copy := _make_label(intro_content, "Ospedale San Vittore, 2026.\n\nSei entrata per inventariare l'ala prima della demolizione. I registri parlano di un'evacuazione completa, ma una porta d'isolamento risulta chiusa dopo l'ordine di sgombero. Dal buio arriva un rumore: nei vecchi appunti, quella presenza è chiamata «il Degente».\n\nTrova badge e fusibile per uscire. I documenti ricostruiscono ciò che è successo a Luca Valli.\n\nWASD muovi · mouse guarda · E raccogli · SHIFT corri · CTRL accovacciati · F torcia · J diario.", Vector2.ZERO, 18, Color(0.75, 0.78, 0.74))
	intro_copy.custom_minimum_size = Vector2(620, 250)
	intro_copy.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	intro_copy.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var tutorial_button := Button.new()
	tutorial_button.text = "INIZIA · TUTORIAL NARRATIVO"
	tutorial_button.custom_minimum_size = Vector2(320, 52)
	tutorial_button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	tutorial_button.pressed.connect(func() -> void: _start_game(true))
	intro_content.add_child(tutorial_button)
	var skip_button := Button.new()
	skip_button.text = "SALTA · ENTRA NEL REPARTO"
	skip_button.custom_minimum_size = Vector2(320, 44)
	skip_button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	skip_button.pressed.connect(func() -> void: _start_game(false))
	intro_content.add_child(skip_button)

	ending_panel = _make_overlay(root)
	var end_content := _make_center_card(ending_panel)
	_make_label(end_content, "IL RAPPORTO ERA FALSO", Vector2.ZERO, 34, Color(0.84, 0.86, 0.78))
	var ending_copy := _make_label(end_content, "Luca Valli non era stato evacuato. Qualcuno aveva chiuso la porta e cancellato il suo nome dai registri. Il reparto è rimasto in silenzio per ventotto anni.\n\nHai portato fuori le prove. Nelle registrazioni, i colpi cessano.", Vector2.ZERO, 20, Color(0.75, 0.78, 0.74))
	ending_copy.custom_minimum_size = Vector2(620, 150)
	ending_copy.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	ending_copy.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var restart_button := Button.new()
	restart_button.text = "RICOMINCIA"
	restart_button.custom_minimum_size = Vector2(220, 48)
	restart_button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	restart_button.pressed.connect(func() -> void: get_tree().reload_current_scene())
	end_content.add_child(restart_button)
	ending_panel.visible = false

	journal_panel = _make_overlay(root)
	var journal_content := _make_center_card(journal_panel)
	_make_label(journal_content, "DIARIO DEL SOPRALLUOGO", Vector2.ZERO, 30, Color(0.84, 0.86, 0.78))
	journal_text = _make_label(journal_content, _journal_summary(), Vector2.ZERO, 17, Color(0.75, 0.78, 0.74))
	journal_text.custom_minimum_size = Vector2(640, 280)
	journal_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var close_journal := Button.new()
	close_journal.text = "TORNA AL REPARTO  ·  J"
	close_journal.custom_minimum_size = Vector2(260, 48)
	close_journal.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	close_journal.pressed.connect(_toggle_journal)
	journal_content.add_child(close_journal)
	journal_panel.visible = false


func _make_label(parent: Control, text: String, position: Vector2, font_size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.position = position
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	parent.add_child(label)
	return label


func _make_overlay(parent: Control) -> Control:
	var overlay := ColorRect.new()
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.color = Color(0.012, 0.018, 0.02, 0.92)
	overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	parent.add_child(overlay)
	return overlay


func _make_center_card(parent: Control) -> VBoxContainer:
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	parent.add_child(center)
	var content := VBoxContainer.new()
	content.add_theme_constant_override("separation", 20)
	content.alignment = BoxContainer.ALIGNMENT_CENTER
	center.add_child(content)
	return content


func _start_game(with_tutorial := true) -> void:
	intro_panel.visible = false
	active = true
	tutorial_active = with_tutorial
	if with_tutorial:
		tutorial_step = 0
		tutorial_crouch_distance = 0.0
		tutorial_start_position = player.global_position
		stalker.global_position = Vector3(0.0, 0.0, -11.5)
		stalker_state = "patrol"
		flashlight.visible = false
		tutorial_panel.visible = true
		_set_tutorial_step(0)
	else:
		tutorial_step = -1
		stalker.global_position = Vector3(0.0, 0.0, -43.0)
		tutorial_panel.visible = false
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	if not with_tutorial:
		_show_message("Qualcosa ti ha sentita entrare. Trova il badge e un fusibile per aprire l'uscita.")


func _set_tutorial_step(step: int) -> void:
	tutorial_step = step
	match step:
		0:
			tutorial_label.text = "PROLOGO  ·  Muoviti nel corridoio con WASD e orienta lo sguardo con il mouse. Premi T in qualsiasi momento per saltare il tutorial."
		1:
			tutorial_label.text = "IL DEGENTE  ·  Qualcuno è rimasto qui. Premi F per accendere la torcia e punta la luce sulla figura in fondo al corridoio."
		2:
			tutorial_label.text = "FUGA  ·  La luce lo trattiene, ma consuma batteria. Spegnila con F, tieni premuto CTRL e avanza senza correre."
		3:
			tutorial_label.text = "RISORSE  ·  Cerca la batteria di emergenza accanto alla barella. Inquadrala e premi E per raccoglierla."
		_:
			tutorial_label.text = ""


func _update_tutorial(_input_vector: Vector2, _delta: float) -> void:
	match tutorial_step:
		0:
			var moved := Vector2(
				player.global_position.x - tutorial_start_position.x,
				player.global_position.z - tutorial_start_position.z
			).length()
			if moved > 1.8:
				_set_tutorial_step(1)
		1:
			if flashlight.visible and _player_sees_stalker():
				_set_tutorial_step(2)
		2:
			if not flashlight.visible and tutorial_crouch_distance >= 2.4:
				_set_tutorial_step(3)


func _finish_tutorial() -> void:
	tutorial_active = false
	tutorial_step = -1
	tutorial_panel.visible = false
	_show_message("Tutorial completato. Il Degente si muove di nuovo: trova badge e fusibile, poi raggiungi l'uscita.")
	_update_hud()


func _end_game(won: bool) -> void:
	ended = true
	active = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	if won:
		ending_panel.visible = true
	else:
		ending_panel.visible = true
		var title: Label = ending_panel.get_child(0).get_child(0).get_child(0)
		title.text = "I COLPI SI FERMANO"
		var copy: Label = ending_panel.get_child(0).get_child(0).get_child(1)
		copy.text = "La torcia cade sul pavimento. Nel buio, senti tre colpi dall'interno della porta dell'isolamento. Poi silenzio."
